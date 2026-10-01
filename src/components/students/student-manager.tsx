"use client";
import * as React from "react";
import {
  ArrowRightLeft,
  Download,
  Eye,
  FileClock,
  Pencil,
  Power,
  Sheet,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Checkbox, EmptyState, ErrorState, SearchInput, Skeleton } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { apiFetch, errorMessage, useApi } from "@/lib/client/api";
import type { Dataset, Student } from "@/lib/client/types";
import { displayRoll, rollWidth } from "@/lib/roll";
import { cn, formatDateTime, pluralize } from "@/lib/utils";
import { StudentImportDialog } from "./student-import-dialog";
import { ImportHistoryDialog, MoveStudentDialog, StudentDetailDialog, StudentFormDialog } from "./student-dialogs";
import { useUser } from "@/components/layout/user-context";

function exportCsv(name: string, students: Student[]) {
  const w = rollWidth(students.map((s) => s.rollNumber));
  const esc = (v: string) => {
    const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [["Roll Number", "Student Name", "Status"], ...students.map((s) => [displayRoll(s.rollNumber, w), s.name, s.status])]
    .map((r) => r.map(esc).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, "_")}_students.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Full student list management for one dataset (a class or the profile master list). */
export function StudentManager({
  datasetId,
  label,
  profileDatasetId,
  onChanged,
  compactHeader,
}: {
  datasetId: string;
  label: string;
  profileDatasetId?: string | null;
  onChanged?: () => void;
  compactHeader?: boolean;
}) {
  const { user } = useUser();
  const confirm = useConfirm();
  const { data, error, isLoading, mutate } = useApi<{ dataset: Dataset; students: Student[] }>(
    `/api/datasets/${datasetId}/students?includeInactive=1`,
  );
  const [q, setQ] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState<null | "file" | "google-sheet">(null);
  const [form, setForm] = React.useState<{ open: boolean; student: Student | null }>({ open: false, student: null });
  const [move, setMove] = React.useState<Student | null>(null);
  const [detail, setDetail] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const refresh = () => {
    mutate();
    onChanged?.();
  };

  const all = data?.students ?? [];
  const active = all.filter((s) => s.status === "active");
  const width = rollWidth(all.map((s) => s.rollNumber));
  const needle = q.trim().toLowerCase();
  const rollNeedle = needle.replace(/^0+(?=\d)/, "");
  const visible = all.filter(
    (s) =>
      (showInactive || s.status === "active") &&
      (!needle || s.name.toLowerCase().includes(needle) || s.rollNumber.toLowerCase().startsWith(rollNeedle)),
  );

  async function setStatus(s: Student, status: "active" | "inactive") {
    if (
      status === "inactive" &&
      !(await confirm({
        title: "Deactivate student?",
        description: `${s.name} will be hidden from new attendance. Their past records stay as they are.`,
        confirmLabel: "Deactivate",
      }))
    )
      return;
    try {
      await apiFetch(`/api/students/${s.id}`, { method: "PATCH", body: { status } });
      toast.success(status === "active" ? "Student reactivated" : "Student deactivated");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(s: Student) {
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      description: "They'll be removed from this class list. Attendance already recorded keeps their name and roll number.",
      confirmLabel: "Delete student",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/students/${s.id}`, { method: "DELETE" });
      toast.success("Student deleted");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">{compactHeader ? "Students" : `Student data · ${label}`}</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {isLoading ? "Loading…" : `${pluralize(active.length, "student")}`}
            {data?.dataset.lastImportedAt && ` · Last updated ${formatDateTime(data.dataset.lastImportedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setImportOpen("file")}>
            <Upload /> {active.length ? "Update student data" : "Upload student file"}
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen("google-sheet")}>
            <Sheet /> Import Google Sheet
          </Button>
          <MoreMenu
            label="More student actions"
            items={[
              { label: "Add student", icon: UserPlus, onSelect: () => setForm({ open: true, student: null }) },
              { label: "Export students (CSV)", icon: Download, onSelect: () => exportCsv(label, all), disabled: !all.length },
              { label: "Import history", icon: FileClock, onSelect: () => setHistoryOpen(true) },
            ]}
          />
        </div>
      </div>

      {error ? (
        <div className="p-5">
          <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-2 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : !all.length ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Upload a student file or import a Google Sheet to start taking attendance."
          actions={
            <>
              <Button onClick={() => setImportOpen("file")}>
                <Upload /> Upload student file
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen("google-sheet")}>
                <Sheet /> Import Google Sheet
              </Button>
              <Button variant="ghost" onClick={() => setForm({ open: true, student: null })}>
                <UserPlus /> Add manually
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput value={q} onChange={setQ} placeholder="Search students by name or roll number" className="sm:max-w-sm sm:flex-1" />
            {all.length !== active.length && (
              <Checkbox checked={showInactive} onChange={setShowInactive} label={`Show deactivated (${all.length - active.length})`} />
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Students in {label}</caption>
              <thead className="border-y border-border bg-muted/60 text-xs text-fg-muted">
                <tr>
                  <th scope="col" className="w-24 px-5 py-2.5 font-medium">
                    Roll
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">
                    Status
                  </th>
                  <th scope="col" className="w-14 px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className={cn("border-b border-border last:border-0 hover:bg-muted/40", s.status === "inactive" && "opacity-60")}>
                    <td className="tabular px-5 py-2.5 font-mono text-[13px] font-medium text-fg">{displayRoll(s.rollNumber, width)}</td>
                    <td className="px-3 py-2.5">
                      <button className="text-left text-fg hover:text-primary hover:underline" onClick={() => setDetail(s.id)}>
                        {s.name}
                      </button>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Deactivated"}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <MoreMenu
                        label={`Actions for ${s.name}`}
                        items={[
                          { label: "View", icon: Eye, onSelect: () => setDetail(s.id) },
                          { label: "Edit", icon: Pencil, onSelect: () => setForm({ open: true, student: s }) },
                          { label: "Move", icon: ArrowRightLeft, onSelect: () => setMove(s) },
                          s.status === "active"
                            ? { label: "Deactivate", icon: Power, onSelect: () => setStatus(s, "inactive") }
                            : { label: "Reactivate", icon: Power, onSelect: () => setStatus(s, "active") },
                          { type: "separator" },
                          { label: "Delete", icon: Trash2, onSelect: () => remove(s), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <p className="px-5 py-8 text-center text-sm text-fg-muted">No students match “{q}”.</p>}
          </div>
        </>
      )}

      <StudentImportDialog
        open={importOpen !== null}
        onOpenChange={(o) => !o && setImportOpen(null)}
        datasetId={datasetId}
        targetLabel={label}
        initialSource={importOpen ?? "file"}
        profileDatasetId={profileDatasetId}
        onImported={refresh}
      />
      <StudentFormDialog
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        datasetId={datasetId}
        student={form.student}
        onSaved={refresh}
      />
      <MoveStudentDialog open={!!move} onOpenChange={(o) => !o && setMove(null)} student={move} onMoved={refresh} />
      <StudentDetailDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        studentId={detail}
        threshold={user.preferences.lowAttendanceThreshold}
      />
      <ImportHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} datasetId={datasetId} />
    </Card>
  );
}
