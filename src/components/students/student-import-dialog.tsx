"use client";
import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Link2,
  Minus,
  Pencil,
  Plus,
  Sheet,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Checkbox, Progress, Segmented } from "@/components/ui/misc";
import { apiFetch, errorMessage, uploadWithProgress } from "@/lib/client/api";
import {
  buildPreview,
  diffStudents,
  ISSUE_LABELS,
  type ColumnMapping,
  type Detection,
  type RawTable,
} from "@/lib/import/core";
import { displayRoll, rollWidth } from "@/lib/roll";
import { cn, pluralize } from "@/lib/utils";
import type { Dataset, RollFormat, Student } from "@/lib/client/types";

const MAX_MB = 5;
const ACCEPT = ".csv,.xlsx,.xls,.pdf,.docx,.doc";
const EXTS = ["csv", "xlsx", "xls", "pdf", "docx", "doc"];

type ParseResponse = {
  fileName: string;
  kind: string;
  sheetName: string | null;
  needsReview: boolean;
  table: RawTable;
  detection: Detection;
};

type Source = "file" | "google-sheet" | "profile-copy";
type Step = "source" | "working" | "mapping" | "preview" | "saving" | "done";

export function StudentImportDialog({
  open,
  onOpenChange,
  datasetId,
  targetLabel,
  initialSource = "file",
  profileDatasetId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  datasetId: string;
  targetLabel: string;
  initialSource?: Source;
  profileDatasetId?: string | null;
  onImported?: () => void;
}) {
  const [step, setStep] = React.useState<Step>("source");
  const [source, setSource] = React.useState<Source>(initialSource);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [workingLabel, setWorkingLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParseResponse | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>({ roll: null, name: null });
  const [format, setFormat] = React.useState<RollFormat>("numeric");
  const [removeMissing, setRemoveMissing] = React.useState(true);
  const [existing, setExisting] = React.useState<Student[] | null>(null);
  const [result, setResult] = React.useState<{ added: number; updated: number; removed: number; unchanged: number } | null>(null);

  // Reset when (re)opened
  React.useEffect(() => {
    if (!open) return;
    setStep("source");
    setSource(initialSource);
    setError(null);
    setParsed(null);
    setResult(null);
    setExisting(null);
    apiFetch<{ students: Student[]; dataset: Dataset }>(`/api/datasets/${datasetId}/students?includeInactive=1`)
      .then((r) => setExisting(r.students))
      .catch(() => setExisting([]));
  }, [open, datasetId, initialSource]);

  function accept(res: ParseResponse) {
    setParsed(res);
    setMapping(res.detection.mapping);
    setFormat(res.detection.suggestedFormat);
    const m = res.detection.mapping;
    setStep(m.roll === null || m.name === null || m.roll === m.name || res.needsReview ? "mapping" : "preview");
  }

  async function handleFile(file: File) {
    setError(null);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!EXTS.includes(ext)) return setError("Unsupported file. Upload a CSV, XLSX, XLS, PDF or DOCX file.");
    if (file.size === 0) return setError("This file is empty.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`This file is larger than ${MAX_MB} MB.`);
    setStep("working");
    setWorkingLabel("Uploading file…");
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await uploadWithProgress<ParseResponse>("/api/imports/parse", form, (p) => {
        setProgress(p);
        if (p >= 100) {
          setWorkingLabel("Reading student data…");
          setProgress(null);
        }
      });
      accept(res);
    } catch (e) {
      setError(errorMessage(e));
      setStep("source");
    }
  }

  async function handleSheet(url: string) {
    setError(null);
    setStep("working");
    setWorkingLabel("Fetching Google Sheet…");
    setProgress(null);
    try {
      accept(await apiFetch<ParseResponse>("/api/imports/google-sheet", { body: { url } }));
    } catch (e) {
      setError(errorMessage(e));
      setStep("source");
    }
  }

  async function handleProfileCopy() {
    if (!profileDatasetId) return;
    setError(null);
    setStep("working");
    setWorkingLabel("Loading master dataset…");
    try {
      const r = await apiFetch<{ students: Student[]; dataset: Dataset }>(`/api/datasets/${profileDatasetId}/students`);
      if (!r.students.length) throw new Error("Your master dataset is empty. Upload a file to your profile first.");
      setFormat(r.dataset.rollFormat);
      setParsed({
        fileName: "Master student dataset",
        kind: "profile-copy",
        sheetName: null,
        needsReview: false,
        table: { headers: ["Roll Number", "Student Name"], rows: r.students.map((s) => [s.rollNumber, s.name]) },
        detection: { mapping: { roll: 0, name: 1 }, confidence: "high", suggestedFormat: r.dataset.rollFormat },
      });
      setMapping({ roll: 0, name: 1 });
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage(e));
      setStep("source");
    }
  }

  const preview = React.useMemo(
    () => (parsed && step !== "source" ? buildPreview(parsed.table, mapping, format) : null),
    [parsed, mapping, format, step],
  );
  const diff = React.useMemo(() => {
    if (!preview || !existing || preview.errors) return null;
    return diffStudents(
      existing.map((s) => ({ id: s.id, rollNumber: s.rollNumber, name: s.name, status: s.status })),
      preview.rows.map((r) => ({ rollNumber: r.rollNumber, name: r.name })),
    );
  }, [preview, existing]);

  async function commit() {
    if (!preview || !parsed) return;
    setStep("saving");
    try {
      const r = await apiFetch<{ added: number; updated: number; removed: number; unchanged: number }>("/api/imports/commit", {
        body: {
          datasetId,
          fileName: parsed.fileName,
          source: parsed.kind === "google-sheet" ? "google-sheet" : parsed.kind === "profile-copy" ? "profile-copy" : "file",
          fileKind: parsed.kind,
          rollFormat: format,
          removeMissing,
          students: preview.rows.map((r) => ({ rollNumber: r.rollNumber, name: r.name })),
        },
      });
      setResult(r);
      setStep("done");
      onImported?.();
      toast.success("Student data saved");
    } catch (e) {
      setError(errorMessage(e));
      setStep("preview");
    }
  }

  const isUpdate = (existing?.length ?? 0) > 0;
  const title =
    step === "mapping" ? "Confirm columns" : step === "preview" || step === "saving" ? "Student data preview" : step === "done" ? "Import complete" : isUpdate ? "Update student data" : "Import student data";

  return (
    <Dialog open={open} onOpenChange={(o) => step !== "saving" && onOpenChange(o)}>
      <DialogContent
        title={title}
        description={step === "source" || step === "working" ? `Students will be added to ${targetLabel}.` : undefined}
        size={step === "preview" || step === "saving" ? "xl" : "lg"}
        onInteractOutside={(e) => step !== "source" && e.preventDefault()}
      >
        {step === "source" && (
          <SourceStep
            source={source}
            setSource={setSource}
            error={error}
            onFile={handleFile}
            onSheet={handleSheet}
            onProfileCopy={profileDatasetId && profileDatasetId !== datasetId ? handleProfileCopy : undefined}
          />
        )}

        {step === "working" && (
          <DialogBody className="py-14">
            <div className="mx-auto max-w-sm text-center" role="status" aria-live="polite">
              <FileSpreadsheet className="mx-auto mb-4 size-8 text-primary" aria-hidden />
              <p className="text-sm font-medium text-fg">{workingLabel}</p>
              <div className="mt-4">
                <Progress value={progress} label={workingLabel} />
              </div>
              <p className="mt-2 text-xs text-fg-muted">{progress !== null ? `${progress}%` : "Please wait."}</p>
            </div>
          </DialogBody>
        )}

        {step === "mapping" && parsed && (
          <MappingStep
            parsed={parsed}
            mapping={mapping}
            setMapping={setMapping}
            onBack={() => setStep("source")}
            onContinue={() => setStep("preview")}
          />
        )}

        {(step === "preview" || step === "saving") && parsed && preview && (
          <>
            <DialogBody className="grid gap-5">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs text-fg-muted">File</div>
                  <div className="truncate font-medium text-fg" title={parsed.fileName}>
                    {parsed.fileName}
                    {parsed.sheetName ? ` · ${parsed.sheetName}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted">Students detected</div>
                  <div className="tabular font-medium text-fg">{preview.total}</div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted">Columns detected</div>
                  <div className="truncate font-medium text-fg">
                    {parsed.table.headers[mapping.roll!]} · {parsed.table.headers[mapping.name!]}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-fg-muted">Roll numbers</span>
                  <Segmented
                    size="sm"
                    label="Roll number format"
                    value={format}
                    onChange={setFormat}
                    options={[
                      { value: "numeric", label: "Numbers (01, 02…)" },
                      { value: "alphanumeric", label: "IDs (TVE23CS001…)" },
                    ]}
                  />
                </div>
                {parsed.kind !== "profile-copy" && (
                  <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
                    <Pencil /> Change columns
                  </Button>
                )}
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}

              {preview.errors > 0 ? (
                <ImportErrors preview={preview} />
              ) : preview.warnings > 0 ? (
                <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
                  <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
                  <div>
                    <div className="font-medium text-fg">Some students share a name</div>
                    <p className="text-fg-muted">
                      This is allowed — two students can have the same name. Check the highlighted rows aren&apos;t duplicate entries.
                    </p>
                  </div>
                </div>
              ) : null}

              {diff && isUpdate && <DiffSummary diff={diff} removeMissing={removeMissing} setRemoveMissing={setRemoveMissing} />}

              <PreviewTable rows={preview.rows} />
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("source")} className="sm:mr-auto" disabled={step === "saving"}>
                <ArrowLeft /> Choose another file
              </Button>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={step === "saving"}>
                Cancel
              </Button>
              <Button
                onClick={commit}
                loading={step === "saving"}
                disabled={preview.errors > 0 || !preview.total || existing === null}
              >
                {step === "saving"
                  ? "Saving students…"
                  : isUpdate
                    ? "Apply changes"
                    : `Import ${pluralize(preview.total, "Student")}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && result && (
          <>
            <DialogBody className="py-10 text-center">
              <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold text-fg">Student data saved</h3>
              <p className="mt-1 text-sm text-fg-muted">The attendance grid for {targetLabel} is updated.</p>
              <div className="mx-auto mt-5 flex max-w-sm justify-center gap-2">
                <Badge tone="success">
                  <Plus /> {result.added} new
                </Badge>
                <Badge tone="primary">
                  <Pencil /> {result.updated} updated
                </Badge>
                <Badge tone="neutral">
                  <Minus /> {result.removed} deactivated
                </Badge>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceStep({
  source,
  setSource,
  error,
  onFile,
  onSheet,
  onProfileCopy,
}: {
  source: Source;
  setSource: (s: Source) => void;
  error: string | null;
  onFile: (f: File) => void;
  onSheet: (url: string) => void;
  onProfileCopy?: () => void;
}) {
  const [drag, setDrag] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const options: { value: Source; label: string; icon: React.ElementType }[] = [
    { value: "file", label: "Upload file", icon: FileUp },
    { value: "google-sheet", label: "Google Sheet", icon: Sheet },
  ];
  if (onProfileCopy) options.push({ value: "profile-copy", label: "Master dataset", icon: UserRoundCheck });

  return (
    <DialogBody className="grid gap-5">
      <Segmented label="Import source" value={source} onChange={setSource} options={options} />
      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {source === "file" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={cn(
            "flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            drag ? "border-primary bg-primary-soft" : "border-border bg-muted/40",
          )}
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
            <FileSpreadsheet className="size-6" aria-hidden />
          </div>
          <p className="text-sm font-medium text-fg">Drag &amp; drop your file here</p>
          <p className="my-2 text-xs text-fg-subtle">or</p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Choose student file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
          <p className="mt-4 text-xs text-fg-muted">Supported: CSV, XLSX, XLS, PDF, DOCX · Maximum {MAX_MB} MB</p>
          <p className="mt-1 text-xs text-fg-subtle">
            Spreadsheets give the most reliable results. PDF and Word lists are extracted and always need your review.
          </p>
        </div>
      )}

      {source === "google-sheet" && (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onSheet(url.trim());
          }}
        >
          <Field
            label="Google Sheet URL"
            hint={
              <>
                The sheet must be shared as <strong>Anyone with the link → Viewer</strong>. The tab open in the link (gid) is
                imported. Private sheets: download as .xlsx and upload instead.
              </>
            }
          >
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
              inputMode="url"
              autoFocus
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={!url.trim()}>
              <Link2 /> Import
            </Button>
          </div>
        </form>
      )}

      {source === "profile-copy" && onProfileCopy && (
        <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm">
          <div className="flex items-center gap-2 font-medium text-fg">
            <Users className="size-4" aria-hidden /> Use your master student dataset
          </div>
          <p className="mt-1 text-fg-muted">
            Copies the students saved on your Profile into this class. You&apos;ll see a preview of the changes first.
          </p>
          <Button className="mt-4" onClick={onProfileCopy}>
            Load master dataset
          </Button>
        </div>
      )}
    </DialogBody>
  );
}

function MappingStep({
  parsed,
  mapping,
  setMapping,
  onBack,
  onContinue,
}: {
  parsed: ParseResponse;
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const unsure = parsed.detection.mapping.roll === null || parsed.detection.mapping.name === null;
  const sample = (col: number) =>
    parsed.table.rows
      .map((r) => r[col])
      .filter((v) => v && v.trim())
      .slice(0, 3)
      .join(", ");
  const valid = mapping.roll !== null && mapping.name !== null && mapping.roll !== mapping.name;
  const opts = parsed.table.headers.map((h, i) => (
    <option key={i} value={i}>
      {h} {sample(i) ? `— e.g. ${sample(i).slice(0, 40)}` : ""}
    </option>
  ));
  return (
    <>
      <DialogBody className="grid gap-5">
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <div className="text-fg">
            {unsure
              ? "We couldn't automatically identify the required columns. Select them manually."
              : parsed.kind === "pdf" || parsed.kind === "docx"
                ? "Data extraction requires review. Please verify the detected Roll Number and Student Name columns."
                : "Please confirm the columns we detected."}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Roll Number">
            <Select
              value={mapping.roll ?? ""}
              onChange={(e) => setMapping({ ...mapping, roll: e.target.value === "" ? null : Number(e.target.value) })}
            >
              <option value="">Select column</option>
              {opts}
            </Select>
          </Field>
          <Field label="Student Name">
            <Select
              value={mapping.name ?? ""}
              onChange={(e) => setMapping({ ...mapping, name: e.target.value === "" ? null : Number(e.target.value) })}
            >
              <option value="">Select column</option>
              {opts}
            </Select>
          </Field>
        </div>
        {mapping.roll !== null && mapping.roll === mapping.name && (
          <p className="text-sm text-danger" role="alert">
            Roll Number and Student Name must be different columns.
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">First rows of the uploaded file</caption>
            <thead className="bg-muted text-fg-muted">
              <tr>
                {parsed.table.headers.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-3 py-2 font-medium",
                      (i === mapping.roll || i === mapping.name) && "bg-primary-soft text-primary",
                    )}
                  >
                    {h}
                    {i === mapping.roll && " · Roll"}
                    {i === mapping.name && " · Name"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.table.rows.slice(0, 5).map((r, ri) => (
                <tr key={ri} className="border-t border-border">
                  {parsed.table.headers.map((_, ci) => (
                    <td key={ci} className="max-w-48 truncate whitespace-nowrap px-3 py-2 text-fg">
                      {r[ci]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!valid}>
          Continue
        </Button>
      </DialogFooter>
    </>
  );
}

function ImportErrors({ preview }: { preview: ReturnType<typeof buildPreview> }) {
  const errors = preview.errorSummary.filter((e) => e.code !== "duplicate_name");
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-danger">
        <AlertCircle className="size-4" aria-hidden />
        {pluralize(preview.errors, "row")} need fixing before import
      </div>
      <ul className="mt-2 grid gap-1 text-fg">
        {errors.map((e) => (
          <li key={e.code}>
            <span className="font-medium">{ISSUE_LABELS[e.code]}</span>
            <span className="text-fg-muted">
              {" "}
              — {e.count} {e.count === 1 ? "row" : "rows"}
              {e.examples.length ? ` (e.g. ${e.examples.join(", ")})` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-fg-muted">
        Please correct the source file and upload it again. If your roll numbers are register IDs, switch the format to IDs above.
      </p>
    </div>
  );
}

function DiffSummary({
  diff,
  removeMissing,
  setRemoveMissing,
}: {
  diff: ReturnType<typeof diffStudents>;
  removeMissing: boolean;
  setRemoveMissing: (v: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const none = !diff.added.length && !diff.updated.length && !diff.removed.length;
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-fg">Student data changes</div>
        {!none && (
          <button className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide details" : "Show details"}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <Badge tone="success">
          <Plus /> {diff.added.length} new
        </Badge>
        <Badge tone="primary">
          <Pencil /> {diff.updated.length} updated
        </Badge>
        <Badge tone={diff.removed.length ? "warning" : "neutral"}>
          <Minus /> {diff.removed.length} not in file
        </Badge>
        <Badge>{diff.unchanged} unchanged</Badge>
      </div>
      {none && <p className="mt-2 text-sm text-fg-muted">This file matches the current list — nothing will change.</p>}
      {open && (
        <ul className="mt-3 max-h-48 overflow-y-auto text-sm">
          {diff.added.map((a) => (
            <li key={`a${a.rollNumber}`} className="py-0.5 text-success">
              + {a.rollNumber} {a.name}
            </li>
          ))}
          {diff.updated.map((u) => (
            <li key={`u${u.rollNumber}`} className="py-0.5 text-primary">
              ~ {u.rollNumber} {u.previousName !== u.name ? `${u.previousName} → ${u.name}` : u.name}
              {u.reactivated ? " (reactivated)" : ""}
            </li>
          ))}
          {diff.removed.map((r) => (
            <li key={`r${r.rollNumber}`} className="py-0.5 text-warning">
              − {r.rollNumber} {r.name}
            </li>
          ))}
        </ul>
      )}
      {diff.removed.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <Checkbox
            checked={removeMissing}
            onChange={setRemoveMissing}
            label={`Deactivate ${pluralize(diff.removed.length, "student")} not in this file`}
            description="They'll be hidden from new attendance. Past attendance records are never changed."
          />
        </div>
      )}
    </div>
  );
}

function PreviewTable({ rows }: { rows: ReturnType<typeof buildPreview>["rows"] }) {
  const [filter, setFilter] = React.useState<"all" | "issues">("all");
  const [limit, setLimit] = React.useState(200);
  const issues = rows.filter((r) => r.status !== "valid").length;
  const shown = (filter === "issues" ? rows.filter((r) => r.status !== "valid") : rows).slice(0, limit);
  const w = rollWidth(rows.map((r) => r.rollNumber).filter(Boolean));
  return (
    <div className="grid gap-2">
      {issues > 0 && (
        <Segmented
          size="sm"
          label="Filter rows"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All (${rows.length})` },
            { value: "issues", label: `Issues (${issues})` },
          ]}
        />
      )}
      <div className="max-h-[42vh] overflow-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Students found in the file</caption>
          <thead className="sticky top-0 z-10 bg-muted text-xs text-fg-muted">
            <tr>
              <th scope="col" className="w-28 px-4 py-2.5 font-medium">
                Roll Number
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Student Name
              </th>
              <th scope="col" className="w-48 px-4 py-2.5 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={`${r.sourceRow}`}
                className={cn(
                  "border-t border-border",
                  r.status === "error" && "bg-danger-soft",
                  r.status === "warning" && "bg-warning-soft",
                )}
              >
                <td className="tabular px-4 py-2 font-mono text-[13px] text-fg">
                  {r.rollNumber ? displayRoll(r.rollNumber, w) : <span className="text-danger">{r.rawRoll || "—"}</span>}
                </td>
                <td className="px-4 py-2 text-fg">{r.name || <span className="text-danger">Missing</span>}</td>
                <td className="px-4 py-2">
                  {r.status === "valid" ? (
                    <Badge tone="success">
                      <CheckCircle2 /> Valid
                    </Badge>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      {r.issues.map((i, k) => (
                        <span key={k} className={cn("text-xs", i.level === "error" ? "text-danger" : "text-warning")}>
                          {i.level === "error" ? "✕ " : "! "}
                          {i.message}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length < (filter === "issues" ? issues : rows.length) && (
        <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 500)}>
          Show more rows
        </Button>
      )}
    </div>
  );
}
