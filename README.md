# Smart Attendance

A teacher attendance workspace: import a class list from a spreadsheet, tap the absentees, review names and roll numbers, submit, and share the report on WhatsApp.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Radix UI primitives · Lucide icons · MongoDB (Mongoose) · JWT sessions (jose + bcrypt) · SWR · ExcelJS / PapaParse / Mammoth / unpdf.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in MONGODB_URI and AUTH_SECRET
npm run dev                     # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB / Atlas connection string |
| `AUTH_SECRET` | yes | ≥32 random chars for signing sessions (`openssl rand -hex 32`) |
| `APP_URL` | prod | Public URL used in password-reset links |
| `MAX_UPLOAD_MB` | no | Student-file size limit (default 5) |
| `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` | no | Country code for 10-digit WhatsApp numbers (default 91) |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Sends password-reset emails. Without them, the reset link is printed to the server console in development only. |

### Deploy (Vercel + MongoDB Atlas)
1. Create an Atlas cluster and a database user; allow Vercel's egress (or `0.0.0.0/0` with a strong password).
2. Import the repo in Vercel, add the env vars above, deploy. Vercel serves HTTPS by default.
3. Collections and indexes are created automatically on first use.

### Legacy `.xls` support
`.xls` parsing uses SheetJS, which is listed as an **optional dependency from the official SheetJS CDN** (`cdn.sheetjs.com`). The npm-registry `xlsx` package is outdated and has known security advisories, so it is deliberately not used. If the CDN install is skipped, `.xls` uploads show a friendly “save as .xlsx or .csv” message; every other format still works.

---

## What's included

- **Welcome / onboarding**, register, login, forgot & reset password, logout.
- **Main modules → sub modules**, each sub module with its own student list. Create, edit, duplicate (copies student lists), delete (archives; history is kept).
- **Student file import** — CSV, XLSX, XLS, DOCX, PDF and Google Sheets:
  upload with progress → server-side parse → header-row & column detection (Roll No / Reg No / Admission No / ID …, Name / Student Name / Full Name …) → manual column mapping when unsure → normalisation (`1`, `01`, `001` are the same roll; whitespace trimmed; names never re-cased) → validation (missing/duplicate/invalid rolls and missing names block the import; duplicate names are a warning) → **preview** → **change summary** (+new / ~updated / −not in file) → teacher confirms → saved.
  Only the rolls in the file are created — gaps are never filled.
- **Profile master dataset** — upload once on the Profile page, then copy it into any class from that class's import dialog.
- **Import history** with per-import change logs.
- **Student management** — search, add, edit, move between classes, deactivate/reactivate, soft delete, CSV export, per-student stats.
- **Attendance grid** — everyone starts present, tap to mark absent; compact/detailed views; search, sort (roll, name A–Z/Z–A, status); mark all present / mark all absent (confirmed) / reset; live totals; keyboard arrow-key navigation; status shown by colour **and** icon, text and `aria-pressed`.
- **Drafts** auto-saved on the device with a restore prompt after refresh; **offline queue** submits automatically when back online (the UI never claims it reached the server until it has).
- **Apply → Review → Confirm & Submit**, with absent and present lists showing roll number and name.
- **Duplicate protection** — one session per teacher + sub module + date + session label (unique index), plus idempotent submits per device; existing sessions can be viewed, edited or recorded as “Session 2”.
- **History** with filters (module, sub module, date range, student, status), pagination, detail view, edit, CSV/Excel export and print-to-PDF.
- **Historical snapshots** — each record stores `studentId`, roll and name *as they were that day*. Re-imports, renames and deletions never rewrite history.
- **WhatsApp** — save multiple contacts (name, number, label; numbers masked by default, duplicates rejected) and share a formatted report to several recipients.
- **Analytics** — classes held, average attendance, per-student present/absent/% with a configurable low-attendance threshold; 14-day trend on the dashboard.
- **Global search** (Ctrl/⌘ K) across modules, sub modules, students and records.
- **Light / Dark / System** themes from semantic CSS tokens, applied before first paint (no flash).
- Responsive layout: collapsible sidebar on desktop, bottom navigation + drawer on mobile, full-width attendance flow with sticky action bar.

## How WhatsApp sharing works (honest version)
The app uses WhatsApp's official click-to-chat links (`https://wa.me/<number>?text=…`). WhatsApp opens with the report filled in and **the teacher presses Send**; for several recipients the dialog opens each chat in turn. Nothing is sent automatically. Fully automatic delivery needs the WhatsApp Business Platform (Cloud API) with approved templates and server-side credentials — `src/lib/report.ts` already builds the message text, so a server route can be added without touching the UI.

## Google Sheets
Supported now: sheets shared as **Anyone with the link → Viewer**. The server downloads Google's CSV export of the tab in the link; private sheets get a clear error explaining how to share or export. No credentials are involved or exposed.

For private sheets, add Google OAuth (scope `drive.readonly` or `spreadsheets.readonly`) server-side and pass the access token to `fetchSheetCsv(ref, accessToken)` in `src/lib/import/googleSheets.server.ts` — the rest of the pipeline (detect → validate → preview → commit) is unchanged.

## Architecture

```
src/
├─ app/
│  ├─ (auth)/             welcome, login, register, forgot/reset password
│  ├─ (app)/              authenticated pages (layout checks the session server-side)
│  │  ├─ page.tsx         home dashboard
│  │  ├─ modules/         modules → [id] → [subId] (overview / students / history)
│  │  ├─ attendance/      class picker → [subId] grid → review → submit → share
│  │  ├─ history/         list + [id] detail/edit
│  │  ├─ students/ profile/ settings/ search/ about/
│  └─ api/                route handlers (all auth-checked and owner-scoped)
├─ components/
│  ├─ ui/                 Button, Input/Select/Field, Dialog, ConfirmDialog, Dropdown, Card, Badge, Skeleton, EmptyState, Segmented, SearchInput…
│  ├─ layout/             AppShell (sidebar, header, mobile nav, offline sync), ThemeToggle, Logo
│  ├─ modules/            MainModuleCard, SubModuleCard, create/edit dialogs, shared actions
│  ├─ students/           StudentManager, StudentImportDialog, student dialogs
│  ├─ attendance/         AttendanceGrid, AttendanceTaker, StatusLists, SessionList
│  ├─ whatsapp/           WhatsAppContacts, WhatsAppShareDialog
│  └─ profile/ charts/
├─ lib/
│  ├─ import/core.ts      isomorphic detect/normalise/validate/diff (runs in browser for preview AND on server before saving)
│  ├─ import/*.server.ts  file parsers + Google Sheets fetcher (server only)
│  ├─ models.ts           Mongoose schemas & indexes
│  ├─ services.ts         ownership checks, import apply, summaries
│  ├─ api.ts              route wrapper (safe JSON errors), session lookup
│  ├─ auth/               JWT (edge-safe) + password/session helpers
│  └─ roll.ts phone.ts report.ts validators.ts utils.ts
└─ middleware.ts          page-level auth redirects + security headers
```

### Data model
`User` · `MainModule` · `SubModule` · `StudentDataset` (one per sub module + the profile master list) · `Student` (stable `_id`, canonical roll, soft delete) · `FileImport` (audit log) · `AttendanceSession` with embedded `AttendanceRecord`s (`studentId`, `rollNumberSnapshot`, `studentNameSnapshot`, `status`) · `WhatsAppContact`.

Records are embedded in the session so a submission is written atomically (no half-saved sessions, no transactions needed).

## Security & privacy
- Every API route requires a valid session and scopes every query by `owner`; other teachers get 404s.
- httpOnly, SameSite=Lax session cookie (Secure in production); sessions can be revoked by bumping `sessionVersion` (done on password reset).
- bcrypt (cost 12) passwords; same error for unknown email / wrong password; rate limits on auth and imports (in-memory — use Redis/Upstash on multi-instance deployments).
- Zod validation on every input, server re-validation of imports, roll/phone normalisation server-side.
- Uploads: extension **and** file-signature checks, size and row limits, parsed in memory and never stored or exposed by URL — only the confirmed student list is saved.
- Exports neutralise spreadsheet formula injection. Errors shown to users never include stack traces or database messages; server logs omit student data.
- No secrets in client code; only `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` is public.

## Testing
```bash
npm run test:unit                 # pure logic: detection, validation, rolls, phones, report
npm run dev & npm run test:smoke  # 48 API checks: auth, isolation, import, duplicates, history snapshots, exports
```
Sample files are in `samples/` (`npm run sample` regenerates the 37-student workbook).

The UI was exercised end-to-end in Chromium (desktop light/dark, 390px mobile): onboarding → module → sub module → XLSX import → validation errors → attendance → refresh + draft restore → review → submit → contacts → WhatsApp share → history → duplicate detection → theme persistence.

## Known limits / next steps
- Google Sheets OAuth for private sheets (hook described above).
- Rate limiting is per instance.
- PDF/DOCX extraction handles tables and “roll name” lines; scanned PDFs (images) aren't OCR'd.
- Roadmap from the spec that the structure is ready for: QR attendance, student accounts, low-attendance alerts, WhatsApp Business API delivery, admin dashboard.
