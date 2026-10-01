import "server-only";
import Papa from "papaparse";
import { ImportError } from "./parsers.server";

/**
 * Google Sheets import.
 *
 * Supported today: sheets shared as "Anyone with the link → Viewer". The server
 * downloads Google's official CSV export for the selected tab — no scraping,
 * no credentials in the browser.
 *
 * Private sheets: plug an OAuth access token into `fetchSheetCsv` (see
 * README → "Private Google Sheets"). Credentials must stay server-side.
 */

export type SheetRef = { spreadsheetId: string; gid: string };

export function parseSheetUrl(input: string): SheetRef {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ImportError("invalid_url", "Enter a valid Google Sheets link (it starts with https://docs.google.com/spreadsheets/).");
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new ImportError("invalid_url", "Only links to docs.google.com/spreadsheets are supported.");
  }
  const m = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (!m) throw new ImportError("invalid_url", "This doesn't look like a Google Sheets link.");
  const gidFromHash = url.hash.match(/gid=(\d+)/)?.[1];
  const gid = url.searchParams.get("gid") ?? gidFromHash ?? "0";
  if (!/^\d+$/.test(gid)) throw new ImportError("invalid_url", "The sheet tab in this link isn't valid.");
  return { spreadsheetId: m[1], gid };
}

export async function fetchSheetCsv(ref: SheetRef, accessToken?: string): Promise<string[][]> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${ref.spreadsheetId}/export?format=csv&gid=${ref.gid}`;
  let res: Response;
  try {
    res = await fetch(exportUrl, {
      redirect: "manual",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new ImportError("sheet_unreachable", "We couldn't reach Google Sheets. Check your connection and try again.");
  }

  // Private sheets redirect to a Google sign-in page instead of returning CSV
  if (res.status >= 300 && res.status < 400) {
    throw new ImportError(
      "sheet_private",
      "This sheet isn't shared publicly. In Google Sheets choose Share → General access → \"Anyone with the link\" (Viewer), or download it as .xlsx/.csv and upload the file.",
    );
  }
  if (res.status === 404) throw new ImportError("sheet_not_found", "That Google Sheet (or tab) doesn't exist.");
  if (res.status === 401 || res.status === 403) {
    throw new ImportError("sheet_private", "You don't have access to this sheet. Ask the owner to share it, or upload an exported file.");
  }
  if (!res.ok) throw new ImportError("sheet_failed", "Google Sheets returned an error. Please try again in a moment.");

  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/csv") && !type.includes("text/plain")) {
    throw new ImportError("sheet_private", "This sheet requires sign-in. Share it as \"Anyone with the link\" or upload an exported file.");
  }
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 5 * 1024 * 1024) throw new ImportError("too_large", "This sheet is too large to import.");
  const text = await res.text();
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  if (!parsed.data.length) throw new ImportError("no_data", "The selected sheet tab is empty.");
  return parsed.data;
}
