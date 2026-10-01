import ExcelJS from "exceljs";
import { Types } from "mongoose";
import { route, requireUser, ApiError, oid, notFound } from "@/lib/api";
import { AttendanceSession, type AttendanceSessionDoc } from "@/lib/models";
import { getMainModule, getSubModule, listStudents } from "@/lib/services";
import { compareRoll, displayRoll, rollWidth } from "@/lib/roll";
import { percent } from "@/lib/utils";

export const runtime = "nodejs";

/** Neutralise spreadsheet formula injection (=, +, -, @ prefixes). */
function safe(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
function csvCell(v: unknown) {
  const s = safe(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60) || "attendance";
}

async function respond(name: string, format: string, header: string[], rows: (string | number)[][]) {
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Smart Attendance";
    const ws = wb.addWorksheet("Attendance");
    ws.addRow(header).font = { bold: true };
    rows.forEach((r) => ws.addRow(r.map((c) => (typeof c === "number" ? c : safe(c)))));
    ws.columns.forEach((c, i) => (c.width = Math.min(40, Math.max(10, header[i]?.length ?? 10, i === 1 ? 24 : 0))));
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 *  ?type=session&id=…&format=csv|xlsx   — one session
 *  ?type=submodule&id=…&format=csv|xlsx — attendance register (all sessions)
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const id = sp.get("id");

  if (type === "session") {
    const s = await AttendanceSession.findOne({ _id: oid(id, "Attendance record"), owner: user._id }).lean<AttendanceSessionDoc>();
    if (!s) throw notFound("Attendance record");
    const recs = [...s.records].sort((a, b) => compareRoll(a.rollNumberSnapshot, b.rollNumberSnapshot));
    const w = rollWidth(recs.map((r) => r.rollNumberSnapshot));
    return respond(
      slug(`${s.mainModuleName}_${s.subModuleName}_${s.date}`),
      format,
      ["Roll Number", "Student Name", "Status", "Date", "Time", "Module", "Sub Module"],
      recs.map((r) => [
        displayRoll(r.rollNumberSnapshot, w),
        r.studentNameSnapshot,
        r.status === "present" ? "Present" : "Absent",
        s.date,
        s.time,
        s.mainModuleName,
        s.subModuleName,
      ]),
    );
  }

  if (type === "submodule") {
    const sub = await getSubModule(user, id ?? "");
    const main = await getMainModule(user, String(sub.mainModuleId));
    const sessions = await AttendanceSession.find({ owner: user._id, subModuleId: sub._id })
      .sort({ date: 1, time: 1 })
      .lean<AttendanceSessionDoc[]>();
    // Current students plus anyone who appears in history (e.g. since removed)
    const current = await listStudents(sub.datasetId as Types.ObjectId, { includeInactive: true });
    const people = new Map<string, { roll: string; name: string }>();
    current.forEach((s) => people.set(String(s._id), { roll: s.rollNumber, name: s.name }));
    sessions.forEach((s) =>
      s.records.forEach((r) => {
        const k = String(r.studentId);
        if (!people.has(k)) people.set(k, { roll: r.rollNumberSnapshot, name: r.studentNameSnapshot });
      }),
    );
    const cols = sessions.map((s) => `${s.date}${s.sessionLabel && s.sessionLabel !== "Session 1" ? ` (${s.sessionLabel})` : ""}`);
    const lookup = sessions.map((s) => new Map(s.records.map((r) => [String(r.studentId), r.status])));
    const list = [...people.entries()].sort((a, b) => compareRoll(a[1].roll, b[1].roll));
    const w = rollWidth(list.map(([, p]) => p.roll));
    const rows = list.map(([sid, p]) => {
      let pr = 0;
      let ab = 0;
      const marks = lookup.map((m) => {
        const st = m.get(sid);
        if (st === "present") pr++;
        if (st === "absent") ab++;
        return st === "present" ? "P" : st === "absent" ? "A" : "-";
      });
      return [displayRoll(p.roll, w), p.name, main.name, sub.name, ...marks, pr, ab, pr + ab ? percent(pr, pr + ab) : ""];
    });
    return respond(
      slug(`${main.name}_${sub.name}_register`),
      format,
      ["Roll Number", "Student Name", "Module", "Sub Module", ...cols, "Present", "Absent", "Attendance %"],
      rows as (string | number)[][],
    );
  }
  throw new ApiError(400, "Unknown export type.", "bad_export");
});
