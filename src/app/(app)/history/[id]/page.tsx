"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Download, FileSpreadsheet, MessageCircle, Pencil, Printer, X, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Segmented } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { StatusLists, SummaryStats } from "@/components/attendance/status-lists";
import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { WhatsAppShareDialog } from "@/components/whatsapp/whatsapp-share-dialog";
import { apiFetch, ApiClientError, errorMessage, useApi } from "@/lib/client/api";
import type { Session, SessionRecord } from "@/lib/client/types";
import { rollWidth } from "@/lib/roll";
import { formatDateLong, formatDateTime, formatTime12 } from "@/lib/utils";

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const editing = useSearchParams().get("edit") === "1";
  const confirm = useConfirm();
  const { data, error, isLoading, mutate } = useApi<{ session: Session; records: SessionRecord[] }>(`/api/attendance/${id}`);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [absent, setAbsent] = React.useState<Set<string>>(new Set());
  const [view, setView] = React.useState<"compact" | "detailed">("detailed");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data) setAbsent(new Set(data.records.filter((r) => r.status === "absent").map((r) => r.studentId)));
  }, [data, editing]);

  if (error)
    return error instanceof ApiClientError && error.status === 404 ? (
      <Card>
        <EmptyState icon={History} title="Record not found" description="This attendance record doesn't exist or isn't yours." />
      </Card>
    ) : (
      <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
    );
  if (isLoading || !data)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );

  const { session: s, records } = data;
  const report = {
    date: s.date,
    time: s.time,
    mainModuleName: s.mainModuleName,
    subModuleName: s.subModuleName,
    sessionLabel: s.sessionLabel,
    records: records.map((r) => ({ rollNumber: r.rollNumber, name: r.name, status: r.status })),
  };

  async function save() {
    const changed = records.filter((r) => (r.status === "absent") !== absent.has(r.studentId)).length;
    if (!changed) {
      router.replace(pathname);
      return;
    }
    const ok = await confirm({
      title: "Save changes to this attendance?",
      description: `${changed} ${changed === 1 ? "student's status changes" : "students' statuses change"}. Names and roll numbers recorded on ${formatDateLong(s.date)} stay the same.`,
      confirmLabel: "Save changes",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await apiFetch(`/api/attendance/${id}`, { method: "PATCH", body: { absentStudentIds: [...absent] } });
      toast.success("Attendance updated");
      await mutate();
      router.replace(pathname);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const absentNow = records.filter((r) => absent.has(r.studentId)).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1">
            <Link href="/history" className="hover:text-fg">
              Attendance History
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page">{formatDateLong(s.date)}</span>
          </nav>
        }
        title={editing ? "Edit attendance" : "Attendance details"}
        description={
          <>
            {s.mainModuleName} · {s.subModuleName} · {formatDateLong(s.date)}, {formatTime12(s.time)}
            {s.sessionLabel !== "Session 1" && ` · ${s.sessionLabel}`}
          </>
        }
        actions={
          editing ? (
            <>
              <Button variant="secondary" onClick={() => router.replace(pathname)}>
                <X /> Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setShareOpen(true)} className="bg-[#25D366] text-[#08311a] hover:bg-[#1fbe5b] dark:text-[#08311a]">
                <MessageCircle /> Share
              </Button>
              <Button variant="secondary" onClick={() => router.replace(`${pathname}?edit=1`)}>
                <Pencil /> Edit
              </Button>
              <MoreMenu
                label="Export"
                trigger={
                  <Button variant="secondary">
                    <Download /> Export
                  </Button>
                }
                items={[
                  { label: "CSV", icon: Download, onSelect: () => (window.location.href = `/api/export?type=session&id=${id}&format=csv`) },
                  { label: "Excel (.xlsx)", icon: FileSpreadsheet, onSelect: () => (window.location.href = `/api/export?type=session&id=${id}&format=xlsx`) },
                  { label: "Print / Save as PDF", icon: Printer, onSelect: () => window.print() },
                ]}
              />
            </>
          )
        }
      />

      {editing ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <span>
              <span className="tabular font-semibold text-absent">{absentNow}</span> <span className="text-fg-muted">absent ·</span>{" "}
              <span className="tabular font-semibold text-success">{records.length - absentNow}</span> <span className="text-fg-muted">present</span>
            </span>
            <Segmented
              size="sm"
              label="Grid view"
              value={view}
              onChange={setView}
              options={[
                { value: "compact", label: "Compact" },
                { value: "detailed", label: "Detailed" },
              ]}
            />
          </div>
          <AttendanceGrid
            students={records.map((r) => ({ id: r.studentId, rollNumber: r.rollNumber, name: r.name }))}
            absent={absent}
            onToggle={(sid) =>
              setAbsent((p) => {
                const n = new Set(p);
                if (n.has(sid)) n.delete(sid);
                else n.add(sid);
                return n;
              })
            }
            view={view}
            width={rollWidth(records.map((r) => r.rollNumber))}
          />
        </div>
      ) : (
        <div className="grid gap-6">
          <SummaryStats total={s.total} present={s.present} absent={s.absent} />
          <StatusLists records={records.map((r) => ({ id: r.studentId, rollNumber: r.rollNumber, name: r.name, status: r.status }))} />
          <p className="text-xs text-fg-muted">
            Submitted {s.createdAt ? formatDateTime(s.createdAt) : ""}
            {s.editCount > 0 && s.updatedAt && ` · Edited ${s.editCount}× (last ${formatDateTime(s.updatedAt)})`}
          </p>
        </div>
      )}
      <WhatsAppShareDialog open={shareOpen} onOpenChange={setShareOpen} report={report} />
    </>
  );
}

export default function HistoryDetailPage() {
  return (
    <React.Suspense>
      <Detail />
    </React.Suspense>
  );
}
