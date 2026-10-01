/**
 * Roll-number helpers shared by client and server.
 *
 * Roll numbers are stored in a canonical form:
 *  - numeric format: positive integer without leading zeros ("001" -> "1")
 *  - alphanumeric format: trimmed, upper-cased, internal whitespace removed
 * and displayed padded to the width of the largest roll in the list.
 */
export type RollFormat = "numeric" | "alphanumeric";

export type RollParse = { ok: true; value: string } | { ok: false; reason: string };

export function canonicalRoll(raw: unknown, format: RollFormat = "numeric"): RollParse {
  if (raw === null || raw === undefined) return { ok: false, reason: "Missing roll number" };
  let s = String(raw).trim();
  if (s === "") return { ok: false, reason: "Missing roll number" };

  if (format === "numeric") {
    // Spreadsheets often store integers as "12.0"
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
    if (!/^\d+$/.test(s)) {
      if (/^-/.test(s)) return { ok: false, reason: "Roll number cannot be negative" };
      if (/^\d*\.\d+$/.test(s)) return { ok: false, reason: "Roll number must be a whole number" };
      return { ok: false, reason: `"${s}" is not a valid roll number` };
    }
    const n = s.replace(/^0+(?=\d)/, "");
    if (n === "0") return { ok: false, reason: "Roll number must be greater than zero" };
    if (n.length > 9) return { ok: false, reason: "Roll number is too long" };
    return { ok: true, value: n };
  }

  s = s.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9\-/_.]{0,31}$/.test(s)) {
    return { ok: false, reason: `"${String(raw).trim()}" is not a valid identifier` };
  }
  return { ok: true, value: s };
}

/** Natural comparison so "2" < "10" and "CS2" < "CS10". */
export function compareRoll(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function rollWidth(rolls: string[]) {
  let w = 2;
  for (const r of rolls) if (/^\d+$/.test(r) && r.length > w) w = r.length;
  return w;
}

export function displayRoll(roll: string, width = 2) {
  return /^\d+$/.test(roll) ? roll.padStart(width, "0") : roll;
}

/** Trim and collapse whitespace; never changes letter case or spelling. */
export function normalizeName(raw: unknown) {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/[ \s]+/g, " ").trim();
}

export function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}
