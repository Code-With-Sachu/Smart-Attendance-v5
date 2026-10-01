import { compareRoll, displayRoll, rollWidth } from "./roll";
import { formatDateLong, formatTime12, percent } from "./utils";

export type ReportRecord = { rollNumber: string; name: string; status: "present" | "absent" };

export type ReportInput = {
  date: string;
  time: string;
  mainModuleName: string;
  subModuleName: string;
  sessionLabel?: string;
  records: ReportRecord[];
};

export type ReportOptions = { includePresent: boolean; includeNames: boolean };

/** Plain-text attendance report (WhatsApp formatting: *bold*). */
export function buildAttendanceReport(input: ReportInput, opts: ReportOptions = { includePresent: true, includeNames: true }) {
  const sorted = [...input.records].sort((a, b) => compareRoll(a.rollNumber, b.rollNumber));
  const width = rollWidth(sorted.map((r) => r.rollNumber));
  const absent = sorted.filter((r) => r.status === "absent");
  const present = sorted.filter((r) => r.status === "present");
  const line = (r: ReportRecord) =>
    opts.includeNames ? `${displayRoll(r.rollNumber, width)} — ${r.name}` : displayRoll(r.rollNumber, width);
  const join = (list: ReportRecord[]) => (opts.includeNames ? list.map(line).join("\n") : list.map(line).join(", "));

  const parts = [
    "*ATTENDANCE REPORT*",
    "",
    `Date: ${formatDateLong(input.date)}`,
    `Time: ${formatTime12(input.time)}`,
    "",
    `*${input.mainModuleName}*`,
    input.subModuleName + (input.sessionLabel && input.sessionLabel !== "Session 1" ? ` (${input.sessionLabel})` : ""),
    "",
    `Total Students: ${sorted.length}`,
    `Present: ${present.length}`,
    `Absent: ${absent.length}`,
    `Attendance: ${percent(present.length, sorted.length)}%`,
    "",
    `*ABSENT STUDENTS (${absent.length})*`,
    absent.length ? join(absent) : "None — full attendance",
  ];
  if (opts.includePresent) {
    parts.push("", `*PRESENT STUDENTS (${present.length})*`, present.length ? join(present) : "None");
  }
  return parts.join("\n");
}

export function whatsappLink(text: string, phone?: string) {
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
