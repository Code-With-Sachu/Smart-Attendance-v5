import { z } from "zod";
import { route, requireUser, parseBody, ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { ImportError } from "@/lib/import/parsers.server";
import { fetchSheetCsv, parseSheetUrl } from "@/lib/import/googleSheets.server";
import { detectColumns, gridToTable } from "@/lib/import/core";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().trim().min(1, "Paste a Google Sheets link").max(500) });

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`import:${user._id}`, 30, 10 * 60 * 1000);
  const { url } = await parseBody(req, schema);
  try {
    const ref = parseSheetUrl(url);
    const grid = await fetchSheetCsv(ref);
    const { table, headerFound } = gridToTable(grid);
    if (!table.rows.length) throw new ImportError("no_data", "No student rows were found in this sheet.");
    const detection = detectColumns(table);
    return {
      fileName: `Google Sheet (${ref.spreadsheetId.slice(0, 8)}…, tab ${ref.gid})`,
      kind: "google-sheet",
      sheetName: null,
      needsReview: !headerFound || detection.confidence === "low",
      table,
      detection,
    };
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(422, e.message, e.code);
    throw e;
  }
});
