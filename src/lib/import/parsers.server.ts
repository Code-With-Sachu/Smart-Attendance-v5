import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";

/**
 * Server-side file parsing. Files are parsed in memory and never written to
 * disk or public storage; only the resulting student rows are persisted after
 * the teacher confirms the preview.
 */

export type FileKind = "csv" | "xlsx" | "xls" | "pdf" | "docx" | "doc";

export class ImportError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type ParsedGrid = {
  kind: FileKind;
  grid: string[][];
  /** Extracted from unstructured documents — the teacher must verify columns. */
  needsReview: boolean;
  sheetName?: string;
};

export const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.MAX_UPLOAD_MB ?? 5)) * 1024 * 1024;
export const MAX_ROWS = 5000;

const EXT_KIND: Record<string, FileKind> = {
  csv: "csv",
  txt: "csv",
  xlsx: "xlsx",
  xls: "xls",
  pdf: "pdf",
  docx: "docx",
  doc: "doc",
};

function startsWith(buf: Buffer, bytes: number[]) {
  return bytes.every((b, i) => buf[i] === b);
}

/** Validate by extension AND file signature — never trust the extension alone. */
export function detectKind(fileName: string, buf: Buffer): FileKind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const kind = EXT_KIND[ext];
  if (!kind) {
    throw new ImportError(
      "unsupported_type",
      "This file type isn't supported. Upload a CSV, Excel (XLSX/XLS), PDF or Word (DOCX) file.",
    );
  }
  const isZip = startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
  const isOle = startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0]);
  const isPdf = startsWith(buf, [0x25, 0x50, 0x44, 0x46]);
  const ok =
    (kind === "xlsx" && isZip) ||
    (kind === "docx" && isZip) ||
    (kind === "xls" && isOle) ||
    (kind === "doc" && isOle) ||
    (kind === "pdf" && isPdf) ||
    (kind === "csv" && !isZip && !isOle && !isPdf && !buf.subarray(0, 4096).includes(0));
  if (!ok) {
    throw new ImportError(
      "signature_mismatch",
      "The file contents don't match its extension. It may be corrupted or renamed — export it again and retry.",
    );
  }
  return kind;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("result" in o) return cellToString(o.result);
    if ("text" in o) return cellToString(o.text);
    if ("error" in o) return "";
  }
  return String(v);
}

async function parseCsv(buf: Buffer): Promise<string[][]> {
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  if (res.errors.length && !res.data.length) {
    throw new ImportError("parse_failed", "We couldn't read this CSV file. Check that it's a valid comma-separated file.");
  }
  return res.data;
}

async function parseXlsx(buf: Buffer): Promise<{ grid: string[][]; sheetName?: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs' types expect its own Buffer flavour
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new ImportError("parse_failed", "We couldn't open this Excel file. It may be password-protected or damaged.");
  }
  // Use the first worksheet that has data
  for (const ws of wb.worksheets) {
    const grid: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[]; // 1-based
      const out: string[] = [];
      for (let c = 1; c < values.length; c++) out.push(cellToString(values[c]));
      grid.push(out);
    });
    if (grid.some((r) => r.some((c) => c.trim()))) return { grid, sheetName: ws.name };
  }
  return { grid: [] };
}

async function parseXls(buf: Buffer): Promise<{ grid: string[][]; sheetName?: string }> {
  // Legacy .xls needs SheetJS (optional dependency from the official SheetJS CDN).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let XLSX: any = null;
  try {
    // Loaded at runtime only (not bundled); absent when the optional dependency isn't installed.
    const specifier = "xlsx";
    const mod = await import(/* webpackIgnore: true */ specifier);
    XLSX = mod.default ?? mod;
  } catch {
    XLSX = null;
  }
  if (!XLSX) {
    throw new ImportError(
      "xls_unavailable",
      "Legacy .xls files aren't enabled on this server. Open the file in Excel or Google Sheets and save it as .xlsx or .csv.",
    );
  }
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true, dense: true });
  for (const name of wb.SheetNames) {
    const grid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    const g = grid.map((r) => r.map(cellToString));
    if (g.some((r) => r.some((c) => c.trim()))) return { grid: g, sheetName: name };
  }
  return { grid: [] };
}

const ID_TOKEN = /^(?=.*\d)[A-Za-z0-9][\w\-/]*$/;
const NAME_TOKEN = /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ.'\-]*$/;

/** Turn free text lines ("01. Arun Kumar", "1 TVE23CS001 Arun K") into a grid. */
export function linesToGrid(lines: string[]): string[][] {
  const rows: { ids: string[]; name: string }[] = [];
  for (const raw of lines) {
    const line = raw.replace(/[|\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const tokens = line.split(" ");
    const ids: string[] = [];
    let i = 0;
    while (i < tokens.length && ids.length < 3) {
      const t = tokens[i].replace(/[.):\-]+$/, "");
      if (ID_TOKEN.test(t)) {
        ids.push(t);
        i++;
      } else break;
    }
    const nameTokens = tokens.slice(i).filter((t) => t !== "-" && t !== ":");
    if (!ids.length || !nameTokens.length || !nameTokens.every((t) => NAME_TOKEN.test(t))) continue;
    rows.push({ ids, name: nameTokens.join(" ") });
  }
  if (!rows.length) return [];
  // Use the most common id-column count so stray lines don't skew the shape
  const counts = new Map<number, number>();
  rows.forEach((r) => counts.set(r.ids.length, (counts.get(r.ids.length) ?? 0) + 1));
  const idCols = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const kept = rows.filter((r) => r.ids.length === idCols);
  const header =
    idCols === 1
      ? ["Roll Number", "Student Name"]
      : idCols === 2
        ? ["S.No", "Register Number", "Student Name"]
        : ["S.No", "Register Number", "Other ID", "Student Name"];
  return [header, ...kept.map((r) => [...r.ids, r.name])];
}

function htmlTablesToGrids(html: string): string[][][] {
  const strip = (s: string) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tables.map((t) =>
    (t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((tr) => (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(strip)),
  );
}

async function parseDocx(buf: Buffer): Promise<{ grid: string[][]; needsReview: boolean }> {
  const mammoth = await import("mammoth");
  let html = "";
  try {
    html = (await mammoth.convertToHtml({ buffer: buf })).value;
  } catch {
    throw new ImportError("parse_failed", "We couldn't open this Word document. It may be damaged or password-protected.");
  }
  const grids = htmlTablesToGrids(html).filter((g) => g.length > 1);
  if (grids.length) {
    grids.sort((a, b) => b.length - a.length);
    return { grid: grids[0], needsReview: true };
  }
  const text = (await mammoth.extractRawText({ buffer: buf })).value;
  return { grid: linesToGrid(text.split(/\r?\n/)), needsReview: true };
}

async function parsePdf(buf: Buffer): Promise<{ grid: string[][]; needsReview: boolean }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const res = await extractText(pdf, { mergePages: true });
    text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
  } catch {
    throw new ImportError("parse_failed", "We couldn't read this PDF. It may be scanned, encrypted or damaged.");
  }
  if (!text.trim()) {
    throw new ImportError(
      "pdf_no_text",
      "This PDF has no readable text (it may be a scanned image). Upload the original spreadsheet instead.",
    );
  }
  return { grid: linesToGrid(text.split(/\r?\n/)), needsReview: true };
}

export async function parseStudentFile(fileName: string, buf: Buffer): Promise<ParsedGrid> {
  if (buf.length === 0) throw new ImportError("empty_file", "This file is empty.");
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new ImportError(
      "too_large",
      `This file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
    );
  }
  const kind = detectKind(fileName, buf);
  let result: ParsedGrid;
  switch (kind) {
    case "csv":
      result = { kind, grid: await parseCsv(buf), needsReview: false };
      break;
    case "xlsx": {
      const r = await parseXlsx(buf);
      result = { kind, grid: r.grid, sheetName: r.sheetName, needsReview: false };
      break;
    }
    case "xls": {
      const r = await parseXls(buf);
      result = { kind, grid: r.grid, sheetName: r.sheetName, needsReview: false };
      break;
    }
    case "docx":
      result = { kind, ...(await parseDocx(buf)) };
      break;
    case "pdf":
      result = { kind, ...(await parsePdf(buf)) };
      break;
    case "doc":
      throw new ImportError(
        "doc_unsupported",
        "Older .doc files can't be read reliably. Save the document as .docx or PDF, or export the class list to Excel.",
      );
  }
  if (!result.grid.length || !result.grid.some((r) => r.some((c) => String(c).trim()))) {
    throw new ImportError(
      "no_data",
      kind === "pdf" || kind === "docx"
        ? "We couldn't find a student list in this document. A spreadsheet (CSV/XLSX) gives the most reliable results."
        : "No student data was found in this file.",
    );
  }
  if (result.grid.length > MAX_ROWS + 20) {
    throw new ImportError("too_many_rows", `This file has more than ${MAX_ROWS} rows. Split it into smaller class lists.`);
  }
  return result;
}
