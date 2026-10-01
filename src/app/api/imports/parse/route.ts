import { route, requireUser, ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { ImportError, MAX_UPLOAD_BYTES, parseStudentFile } from "@/lib/import/parsers.server";
import { detectColumns, gridToTable } from "@/lib/import/core";

export const runtime = "nodejs";

/**
 * Parses an uploaded student file in memory and returns a table + suggested
 * column mapping for preview. Nothing is saved here.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`import:${user._id}`, 30, 10 * 60 * 1000);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) {
    throw new ApiError(413, `This file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`, "too_large");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Upload failed. Please choose the file again.", "bad_upload");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.", "no_file");
  const fileName = file.name.slice(0, 200) || "upload";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStudentFile(fileName, buf);
    const { table, headerFound } = gridToTable(parsed.grid);
    const detection = detectColumns(table);
    return {
      fileName,
      kind: parsed.kind,
      sheetName: parsed.sheetName ?? null,
      needsReview: parsed.needsReview || !headerFound || detection.confidence === "low",
      table,
      detection,
    };
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(422, e.message, e.code);
    throw e;
  }
});
