import { Types } from "mongoose";
import { route, requireUser, parseBody, ApiError, oid } from "@/lib/api";
import { AttendanceSession, type AttendanceSessionDoc } from "@/lib/models";
import { attendanceSubmitSchema } from "@/lib/validators";
import { getMainModule, getSubModule, listStudents, serializeSession } from "@/lib/services";
import { compareRoll } from "@/lib/roll";

/** List sessions (filters: module, sub module, date range, student). */
export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = { owner: user._id };

  // Quick duplicate check used before the review screen
  if (sp.get("check") === "1") {
    const existing = await AttendanceSession.findOne(
      {
        owner: user._id,
        subModuleId: oid(sp.get("subModuleId"), "Sub module"),
        date: sp.get("date") ?? "",
        sessionLabel: sp.get("sessionLabel") || "Session 1",
      },
      { _id: 1 },
    ).lean();
    return { exists: !!existing, id: existing ? String(existing._id) : null };
  }

  if (sp.get("mainModuleId")) filter.mainModuleId = oid(sp.get("mainModuleId"));
  if (sp.get("subModuleId")) filter.subModuleId = oid(sp.get("subModuleId"));
  const date = sp.get("date");
  const from = sp.get("from");
  const to = sp.get("to");
  const dateRx = /^\d{4}-\d{2}-\d{2}$/;
  if (date && dateRx.test(date)) filter.date = date;
  else if ((from && dateRx.test(from)) || (to && dateRx.test(to))) {
    filter.date = { ...(from && dateRx.test(from) ? { $gte: from } : {}), ...(to && dateRx.test(to) ? { $lte: to } : {}) };
  }
  const studentId = sp.get("studentId");
  const status = sp.get("status");
  if (studentId) {
    const sid = oid(studentId, "Student");
    filter.records = status === "present" || status === "absent"
      ? { $elemMatch: { studentId: sid, status } }
      : { $elemMatch: { studentId: sid } };
  }
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(sp.get("pageSize") ?? 20) || 20));
  const [total, sessions] = await Promise.all([
    AttendanceSession.countDocuments(filter),
    AttendanceSession.find(filter, { records: 0 })
      .sort({ date: -1, time: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<AttendanceSessionDoc[]>(),
  ]);
  return { sessions: sessions.map(serializeSession), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
});

/** Submit attendance. Idempotent per clientId; one session per sub module/date/label. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, attendanceSubmitSchema);
  const sub = await getSubModule(user, body.subModuleId);
  const main = await getMainModule(user, String(sub.mainModuleId));

  if (body.clientId) {
    const prior = await AttendanceSession.findOne({ owner: user._id, clientId: body.clientId }, { _id: 1 }).lean();
    if (prior) return { id: String(prior._id), duplicateOf: null, replayed: true };
  }
  const existing = await AttendanceSession.findOne(
    { owner: user._id, subModuleId: sub._id, date: body.date, sessionLabel: body.sessionLabel },
    { _id: 1 },
  ).lean();
  if (existing) {
    throw new ApiError(409, "Attendance for this class and session has already been submitted.", "already_exists", {
      existingId: String(existing._id),
    });
  }

  const students = await listStudents(sub.datasetId as Types.ObjectId);
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const submitted = new Set(body.studentIds);
  const unknown = body.studentIds.filter((id) => !byId.has(id));
  const missing = students.filter((s) => !submitted.has(String(s._id)));
  if (unknown.length || missing.length) {
    throw new ApiError(
      409,
      "The student list changed while you were taking attendance. Reload to see the latest list — your marks are kept as a draft.",
      "list_changed",
    );
  }
  const absent = new Set(body.absentStudentIds);
  for (const id of absent) if (!submitted.has(id)) throw new ApiError(400, "An absent student is not in this class.", "bad_absent");

  const records = students
    .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber))
    .map((s) => ({
      studentId: s._id,
      rollNumberSnapshot: s.rollNumber,
      studentNameSnapshot: s.name,
      status: (absent.has(String(s._id)) ? "absent" : "present") as "absent" | "present",
    }));
  try {
    const doc = await AttendanceSession.create({
      owner: user._id,
      mainModuleId: main._id,
      subModuleId: sub._id,
      mainModuleName: main.name,
      subModuleName: sub.name,
      date: body.date,
      time: body.time,
      sessionLabel: body.sessionLabel,
      total: records.length,
      present: records.length - absent.size,
      absent: absent.size,
      records,
      clientId: body.clientId ?? null,
    });
    return { id: String(doc._id) };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      const again = await AttendanceSession.findOne(
        { owner: user._id, subModuleId: sub._id, date: body.date, sessionLabel: body.sessionLabel },
        { _id: 1 },
      ).lean();
      throw new ApiError(409, "Attendance for this class and session has already been submitted.", "already_exists", {
        existingId: again ? String(again._id) : null,
      });
    }
    throw e;
  }
});
