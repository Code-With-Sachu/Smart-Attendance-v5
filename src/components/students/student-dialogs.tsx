"use client";
import * as React from "react";
import Link from "next/link";
import { FileClock, Minus, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { apiFetch, errorMessage, useApi } from "@/lib/client/api";
import type { Dataset, Student } from "@/lib/client/types";
import { displayRoll } from "@/lib/roll";
import { formatDateLong, formatDateTime, formatTime12 } from "@/lib/utils";

export function StudentFormDialog({
  open,
  onOpenChange,
  datasetId,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  datasetId: string;
  student?: Student | null;
  onSaved: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setError(null), [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { rollNumber: String(f.get("rollNumber") ?? ""), name: String(f.get("name") ?? "") };
    setLoading(true);
    setError(null);
    try {
      if (student) await apiFetch(`/api/students/${student.id}`, { method: "PATCH", body });
      else await apiFetch(`/api/datasets/${datasetId}/students`, { body });
      toast.success(student ? "Student updated" : "Student added");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={student ? "Edit student" : "Add student"}
        description={student ? "Past attendance keeps the name and roll number recorded at the time." : "Manual entry — use file import for whole classes."}
        size="sm"
      >
        <form onSubmit={submit} noValidate>
          <DialogBody className="grid gap-4">
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Field label="Roll Number">
              <Input name="rollNumber" defaultValue={student?.rollNumber ?? ""} required autoFocus inputMode="text" />
            </Field>
            <Field label="Student Name">
              <Input name="name" defaultValue={student?.name ?? ""} required autoComplete="off" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {student ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveStudentDialog({
  open,
  onOpenChange,
  student,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student: Student | null;
  onMoved: () => void;
}) {
  const { data } = useApi<{ datasets: (Dataset & { label: string })[] }>(open ? "/api/datasets" : null);
  const [target, setTarget] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const options = (data?.datasets ?? []).filter((d) => d.id !== student?.datasetId);
  async function move() {
    if (!student || !target) return;
    setLoading(true);
    try {
      await apiFetch(`/api/students/${student.id}`, { method: "PATCH", body: { datasetId: target } });
      toast.success(`${student.name} moved`);
      onMoved();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Move student" description={student ? `Move ${student.name} to another class list.` : undefined} size="sm">
        <DialogBody>
          <Field label="Destination" hint="Their past attendance stays with the original class.">
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select a class</option>
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={move} loading={loading} disabled={!target}>
            Move student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type StudentDetail = {
  student: Student;
  stats: { present: number; absent: number; percentage: number | null };
  history: { sessionId: string; date: string; time: string; module: string; status: "present" | "absent" }[];
};

export function StudentDetailDialog({
  open,
  onOpenChange,
  studentId,
  threshold = 75,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  studentId: string | null;
  threshold?: number;
}) {
  const { data, isLoading } = useApi<StudentDetail>(open && studentId ? `/api/students/${studentId}` : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={data ? `${displayRoll(data.student.rollNumber)} — ${data.student.name}` : "Student"}
        description={data?.student.status === "inactive" ? "Deactivated — not shown in new attendance." : undefined}
      >
        <DialogBody className="grid gap-5">
          {isLoading || !data ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-3">
                  <div className="text-xs text-fg-muted">Present</div>
                  <div className="tabular text-xl font-semibold text-fg">{data.stats.present}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-xs text-fg-muted">Absent</div>
                  <div className="tabular text-xl font-semibold text-fg">{data.stats.absent}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-xs text-fg-muted">Attendance</div>
                  <div className="tabular text-xl font-semibold text-fg">
                    {data.stats.percentage === null ? "—" : `${data.stats.percentage}%`}
                  </div>
                  {data.stats.percentage !== null && data.stats.percentage < threshold && (
                    <Badge tone="warning" className="mt-1">
                      Below {threshold}%
                    </Badge>
                  )}
                </div>
              </div>
              {data.history.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {data.history.slice(0, 30).map((h) => (
                    <li key={h.sessionId}>
                      <Link href={`/history/${h.sessionId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted">
                        <span className="min-w-0">
                          <span className="block text-fg">{formatDateLong(h.date)}</span>
                          <span className="block truncate text-xs text-fg-muted">
                            {h.module} · {formatTime12(h.time)}
                          </span>
                        </span>
                        <Badge tone={h.status === "absent" ? "absent" : "success"}>{h.status === "absent" ? "Absent" : "Present"}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">No attendance recorded for this student yet.</p>
              )}
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

type ImportLog = {
  id: string;
  fileName: string;
  source: string;
  totalRows: number;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  changes: { type: "added" | "updated" | "removed"; rollNumber: string; name: string; previousName?: string }[];
  createdAt: string;
};

export function ImportHistoryDialog({ open, onOpenChange, datasetId }: { open: boolean; onOpenChange: (o: boolean) => void; datasetId: string }) {
  const { data, isLoading } = useApi<{ imports: ImportLog[] }>(open ? `/api/datasets/${datasetId}/imports` : null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Import history" description="Every file import and the changes it made." size="lg">
        <DialogBody>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : !data?.imports.length ? (
            <EmptyState icon={FileClock} title="No imports yet" description="Uploaded files and Google Sheet imports will be listed here." />
          ) : (
            <ul className="grid gap-3">
              {data.imports.map((i) => (
                <li key={i.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-fg">{i.fileName}</div>
                      <div className="text-xs text-fg-muted">
                        Imported {formatDateTime(i.createdAt)} · {i.totalRows} students
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === i.id ? null : i.id)} aria-expanded={expanded === i.id}>
                      {expanded === i.id ? "Hide changes" : "View changes"}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="success">
                      <Plus /> {i.added}
                    </Badge>
                    <Badge tone="primary">
                      <Pencil /> {i.updated}
                    </Badge>
                    <Badge>
                      <Minus /> {i.removed}
                    </Badge>
                  </div>
                  {expanded === i.id && (
                    <ul className="mt-3 max-h-56 overflow-y-auto border-t border-border pt-2 text-sm">
                      {i.changes.length === 0 && <li className="text-fg-muted">No changes — the list was already up to date.</li>}
                      {i.changes.map((c, k) => (
                        <li key={k} className={c.type === "added" ? "text-success" : c.type === "updated" ? "text-primary" : "text-warning"}>
                          {c.type === "added" ? "+" : c.type === "updated" ? "~" : "−"} {displayRoll(c.rollNumber)}{" "}
                          {c.previousName && c.previousName !== c.name ? `${c.previousName} → ${c.name}` : c.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
