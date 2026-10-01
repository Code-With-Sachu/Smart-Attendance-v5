/**
 * Pure, isomorphic student-import logic.
 * Runs in the browser for an instant preview and again on the server
 * before anything is written, so the server never trusts client output.
 */
import { canonicalRoll, compareRoll, normalizeName, type RollFormat } from "@/lib/roll";

export type RawTable = {
  headers: string[];
  rows: string[][];
};

export type ColumnMapping = {
  roll: number | null;
  name: number | null;
};

export type Detection = {
  mapping: ColumnMapping;
  /** "high": both columns matched a known header. "low": guessed or missing. */
  confidence: "high" | "low";
  suggestedFormat: RollFormat;
};

const ROLL_HEADERS = [
  "rollnumber",
  "rollno",
  "rollnum",
  "roll",
  "registernumber",
  "registerno",
  "regnumber",
  "regno",
  "registrationnumber",
  "registrationno",
  "admissionnumber",
  "admissionno",
  "admno",
  "studentid",
  "id",
];

const NAME_HEADERS = [
  "studentname",
  "nameofstudent",
  "nameofthestudent",
  "fullname",
  "candidatename",
  "nameofcandidate",
  "name",
  "student",
];

export function normHeader(h: string) {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function matchScore(header: string, list: string[]): number {
  const h = normHeader(header);
  if (!h) return 0;
  const exact = list.indexOf(h);
  if (exact !== -1) return 100 - exact; // earlier synonyms are stronger
  // Partial: "rollnoasperkturecords" contains "rollno"
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.length >= 4 && h.includes(s)) return 50 - i;
  }
  return 0;
}

/**
 * Locate the header row inside a raw grid (title rows above a table are common
 * in exported class lists) and turn the grid into a RawTable.
 */
export function gridToTable(grid: string[][]): { table: RawTable; headerFound: boolean } {
  const cleaned = grid
    .map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))))
    .filter((r) => r.some((c) => c.trim() !== ""));
  if (cleaned.length === 0) return { table: { headers: [], rows: [] }, headerFound: false };

  let bestRow = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(cleaned.length, 15); i++) {
    const row = cleaned[i];
    const r = Math.max(0, ...row.map((c) => matchScore(c, ROLL_HEADERS)));
    const n = Math.max(0, ...row.map((c) => matchScore(c, NAME_HEADERS)));
    const score = (r > 0 ? 1 : 0) + (n > 0 ? 1 : 0) + (r + n) / 1000;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  const width = Math.max(...cleaned.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill("")];

  if (bestRow >= 0 && bestScore >= 1) {
    const headers = pad(cleaned[bestRow]).map((h, i) => (h.trim() ? h.trim() : `Column ${i + 1}`));
    return { table: { headers, rows: cleaned.slice(bestRow + 1).map(pad) }, headerFound: true };
  }
  const headers = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  return { table: { headers, rows: cleaned.map(pad) }, headerFound: false };
}

function looksNumericRoll(v: string) {
  return /^\s*0*\d{1,9}(\.0+)?\s*$/.test(v);
}
function looksName(v: string) {
  const t = v.trim();
  return t.length >= 2 && /[A-Za-zÀ-ɏऀ-෿]/.test(t) && !/\d{3,}/.test(t);
}

export function detectColumns(table: RawTable): Detection {
  let roll: number | null = null;
  let name: number | null = null;
  let rollScore = 0;
  let nameScore = 0;
  table.headers.forEach((h, i) => {
    const r = matchScore(h, ROLL_HEADERS);
    const n = matchScore(h, NAME_HEADERS);
    if (r > rollScore && r >= n) {
      rollScore = r;
      roll = i;
    }
    if (n > nameScore && n > r) {
      nameScore = n;
      name = i;
    }
  });

  // Content heuristics as a fallback (low confidence → teacher must confirm)
  const sample = table.rows.slice(0, 50);
  const ratio = (col: number, fn: (v: string) => boolean) => {
    const vals = sample.map((r) => r[col] ?? "").filter((v) => v.trim() !== "");
    if (!vals.length) return 0;
    return vals.filter(fn).length / vals.length;
  };
  if (roll === null) {
    let best = 0;
    table.headers.forEach((_, i) => {
      if (i === name) return;
      const r = ratio(i, looksNumericRoll);
      if (r > 0.8 && r > best) {
        best = r;
        roll = i;
      }
    });
  }
  if (name === null) {
    let best = 0;
    table.headers.forEach((_, i) => {
      if (i === roll) return;
      const r = ratio(i, looksName);
      if (r > 0.8 && r > best) {
        best = r;
        name = i;
      }
    });
  }

  const confidence = rollScore >= 50 && nameScore >= 50 && roll !== name ? "high" : "low";
  let suggestedFormat: RollFormat = "numeric";
  if (roll !== null) {
    // Only suggest IDs when most values look like register numbers (letters + digits,
    // e.g. TVE23CS001). Stray bad values like "ABC" or "1.5" must still be rejected.
    const idRatio = ratio(roll, (v) => /[A-Za-z]/.test(v) && /\d/.test(v));
    if (idRatio >= 0.6) suggestedFormat = "alphanumeric";
  }
  return { mapping: { roll, name }, confidence, suggestedFormat };
}

export type PreviewIssue = {
  level: "error" | "warning";
  code: "missing_roll" | "invalid_roll" | "duplicate_roll" | "missing_name" | "duplicate_name";
  message: string;
};

export type PreviewRow = {
  sourceRow: number; // 1-based row number in the data section
  rawRoll: string;
  rollNumber: string; // canonical, "" if invalid
  name: string;
  issues: PreviewIssue[];
  status: "valid" | "warning" | "error";
};

export type Preview = {
  rows: PreviewRow[];
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  errorSummary: { code: PreviewIssue["code"]; count: number; examples: string[] }[];
};

export function buildPreview(table: RawTable, mapping: ColumnMapping, format: RollFormat): Preview {
  const rows: PreviewRow[] = [];
  if (mapping.roll === null || mapping.name === null) {
    return { rows, total: 0, valid: 0, warnings: 0, errors: 0, errorSummary: [] };
  }
  table.rows.forEach((r, idx) => {
    const rawRoll = String(r[mapping.roll!] ?? "").trim();
    const rawName = String(r[mapping.name!] ?? "");
    const name = normalizeName(rawName);
    if (!rawRoll && !name) return; // blank line
    const issues: PreviewIssue[] = [];
    let rollNumber = "";
    const parsed = canonicalRoll(rawRoll, format);
    if (parsed.ok) rollNumber = parsed.value;
    else
      issues.push({
        level: "error",
        code: rawRoll ? "invalid_roll" : "missing_roll",
        message: parsed.reason,
      });
    if (!name) issues.push({ level: "error", code: "missing_name", message: "Student name is missing" });
    rows.push({ sourceRow: idx + 1, rawRoll, rollNumber, name, issues, status: "valid" });
  });

  // Duplicates
  const byRoll = new Map<string, PreviewRow[]>();
  const byName = new Map<string, PreviewRow[]>();
  for (const row of rows) {
    if (row.rollNumber) byRoll.set(row.rollNumber, [...(byRoll.get(row.rollNumber) ?? []), row]);
    if (row.name) {
      const k = row.name.toLowerCase();
      byName.set(k, [...(byName.get(k) ?? []), row]);
    }
  }
  for (const [roll, list] of byRoll) {
    if (list.length > 1)
      list.forEach((row) =>
        row.issues.push({
          level: "error",
          code: "duplicate_roll",
          message: `Roll number ${roll} appears ${list.length} times`,
        }),
      );
  }
  for (const list of byName.values()) {
    if (list.length > 1)
      list.forEach((row) =>
        row.issues.push({
          level: "warning",
          code: "duplicate_name",
          message: `${list.length} students share this name — check it's not a duplicate entry`,
        }),
      );
  }

  const summary = new Map<PreviewIssue["code"], { count: number; examples: string[] }>();
  for (const row of rows) {
    row.status = row.issues.some((i) => i.level === "error")
      ? "error"
      : row.issues.length
        ? "warning"
        : "valid";
    for (const i of row.issues) {
      const s = summary.get(i.code) ?? { count: 0, examples: [] };
      s.count++;
      const ex = row.rollNumber || row.rawRoll || `row ${row.sourceRow}`;
      if (s.examples.length < 5 && !s.examples.includes(ex)) s.examples.push(ex);
      summary.set(i.code, s);
    }
  }

  rows.sort((a, b) =>
    a.rollNumber && b.rollNumber ? compareRoll(a.rollNumber, b.rollNumber) : a.sourceRow - b.sourceRow,
  );

  return {
    rows,
    total: rows.length,
    valid: rows.filter((r) => r.status !== "error").length,
    warnings: rows.filter((r) => r.status === "warning").length,
    errors: rows.filter((r) => r.status === "error").length,
    errorSummary: [...summary.entries()].map(([code, v]) => ({ code, ...v })),
  };
}

export type ExistingStudent = { id: string; rollNumber: string; name: string; status: "active" | "inactive" };
export type IncomingStudent = { rollNumber: string; name: string };

export type StudentDiff = {
  added: IncomingStudent[];
  updated: { id: string; rollNumber: string; name: string; previousName: string; reactivated: boolean }[];
  removed: { id: string; rollNumber: string; name: string }[];
  unchanged: number;
};

/** Students are matched by canonical roll number within a dataset. */
export function diffStudents(existing: ExistingStudent[], incoming: IncomingStudent[]): StudentDiff {
  const map = new Map(existing.map((s) => [s.rollNumber, s]));
  const seen = new Set<string>();
  const diff: StudentDiff = { added: [], updated: [], removed: [], unchanged: 0 };
  for (const inc of incoming) {
    seen.add(inc.rollNumber);
    const cur = map.get(inc.rollNumber);
    if (!cur) diff.added.push(inc);
    else if (cur.name !== inc.name || cur.status === "inactive")
      diff.updated.push({
        id: cur.id,
        rollNumber: inc.rollNumber,
        name: inc.name,
        previousName: cur.name,
        reactivated: cur.status === "inactive",
      });
    else diff.unchanged++;
  }
  for (const cur of existing) {
    if (!seen.has(cur.rollNumber) && cur.status === "active")
      diff.removed.push({ id: cur.id, rollNumber: cur.rollNumber, name: cur.name });
  }
  return diff;
}

export const ISSUE_LABELS: Record<PreviewIssue["code"], string> = {
  missing_roll: "Missing roll number",
  invalid_roll: "Invalid roll number",
  duplicate_roll: "Duplicate roll number",
  missing_name: "Missing student name",
  duplicate_name: "Duplicate name",
};
