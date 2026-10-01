"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  Eye,
  History,
  MessageCircle,
  RotateCcw,
  Save,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, SearchInput, Segmented, Skeleton } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { AttendanceGrid } from "./attendance-grid";
import { StatusLists, SummaryStats } from "./status-lists";
import { WhatsAppShareDialog } from "@/components/whatsapp/whatsapp-share-dialog";
import { useUser } from "@/components/layout/user-context";
import { apiFetch, ApiClientError, errorMessage, useApi } from "@/lib/client/api";
import type { SubModuleDetail } from "@/lib/client/types";
import { compareRoll, rollWidth } from "@/lib/roll";
import { formatDateLong, formatTime12, nowHHMM, percent, todayISO } from "@/lib/utils";
import { draftKey, queueOutbox, readLocal, removeLocal, writeLocal, type AttendanceDraft } from "@/lib/client/storage";

type Step = "mark" | "review" | "done";
type SortKey = "roll" | "name-asc" | "name-desc" | "status";

const SESSION_LABELS = ["Session 1", "Session 2", "Session 3", "Session 4", "Session 5", "Session 6"];

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function AttendanceTaker({ subModuleId }: { subModuleId: string }) {
  const confirm = useConfirm();
  const { user } = useUser();
  const { data, error, isLoading, mutate } = useApi<SubModuleDetail>(`/api/submodules/${subModuleId}`);

  const [step, setStep] = React.useState<Step>("mark");
  const [absent, setAbsent] = React.useState<Set<string>>(new Set());
  const [date, setDate] = React.useState(todayISO());
  const [time, setTime] = React.useState(nowHHMM());
  const [sessionLabel, setSessionLabel] = React.useState("Session 1");
  const [view, setView] = React.useState<"compact" | "detailed">(user.preferences.attendanceView);
  const [sort, setSort] = React.useState<SortKey>("roll");
  const [q, setQ] = React.useState("");
  const [draftState, setDraftState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [restore, setRestore] = React.useState<AttendanceDraft | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [existing, setExisting] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ id: string | null; offline: boolean } | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const clientId = React.useRef(newClientId());

  const students = React.useMemo(
    () => (data?.students ?? []).filter((s) => s.status === "active").sort((a, b) => compareRoll(a.rollNumber, b.rollNumber)),
    [data],
  );
  const width = rollWidth(students.map((s) => s.rollNumber));
  const key = draftKey(user.id, subModuleId);

  // Offer to restore an unsaved draft once students have loaded
  React.useEffect(() => {
    if (!data) return;
    const d = readLocal<AttendanceDraft | null>(key, null);
    if (d && (d.absentIds.length || d.date !== todayISO())) setRestore(d);
  }, [data, key]);

  // Auto-save the draft on this device (never claimed as synced)
  React.useEffect(() => {
    if (!dirty || step === "done") return;
    setDraftState("saving");
    const t = setTimeout(() => {
      const ok = writeLocal(key, {
        subModuleId,
        date,
        time,
        sessionLabel,
        absentIds: [...absent],
        studentIds: students.map((s) => s.id),
        savedAt: new Date().toISOString(),
      } satisfies AttendanceDraft);
      setDraftState(ok ? "saved" : "idle");
    }, 400);
    return () => clearTimeout(t);
  }, [absent, date, time, sessionLabel, dirty, key, subModuleId, students, step]);

  // Warn before leaving with unsaved marks
  React.useEffect(() => {
    if (!dirty || step === "done") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, step]);

  const toggle = React.useCallback((id: string) => {
    setDirty(true);
    setAbsent((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const visible = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rollNeedle = needle.replace(/^0+(?=\d)/, "");
    const list = students.filter(
      (s) => !needle || s.name.toLowerCase().includes(needle) || s.rollNumber.toLowerCase().startsWith(rollNeedle),
    );
    const sorted = [...list];
    if (sort === "name-asc") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name-desc") sorted.sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "status") sorted.sort((a, b) => Number(absent.has(b.id)) - Number(absent.has(a.id)) || compareRoll(a.rollNumber, b.rollNumber));
    return sorted;
    // status sort intentionally re-evaluates when marks change
  }, [students, q, sort, absent]);

  const total = students.length;
  const absentCount = students.filter((s) => absent.has(s.id)).length;
  const presentCount = total - absentCount;

  async function markAllAbsent() {
    const ok = await confirm({
      title: "Mark all students absent?",
      description: `All ${total} students will be marked absent. You can tap students to mark them present again.`,
      confirmLabel: "Mark all absent",
      tone: "danger",
    });
    if (ok) {
      setDirty(true);
      setAbsent(new Set(students.map((s) => s.id)));
    }
  }

  async function apply() {
    setChecking(true);
    try {
      const r = await apiFetch<{ exists: boolean; id: string | null }>(
        `/api/attendance?check=1&subModuleId=${subModuleId}&date=${date}&sessionLabel=${encodeURIComponent(sessionLabel)}`,
      );
      if (r.exists) setExisting(r.id);
      else {
        setStep("review");
        window.scrollTo({ top: 0 });
      }
    } catch (e) {
      // Offline: still allow review — submission will be queued on this device
      if (e instanceof ApiClientError && e.isNetwork) {
        setStep("review");
        window.scrollTo({ top: 0 });
      } else toast.error(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    const payload = {
      subModuleId,
      date,
      time,
      sessionLabel,
      clientId: clientId.current,
      studentIds: students.map((s) => s.id),
      absentStudentIds: students.filter((s) => absent.has(s.id)).map((s) => s.id),
    };
    try {
      const r = await apiFetch<{ id: string }>("/api/attendance", { body: payload });
      removeLocal(key);
      setResult({ id: r.id, offline: false });
      setConfirmOpen(false);
      setStep("done");
      toast.success("Attendance submitted successfully");
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiClientError && e.isNetwork) {
        const saved = queueOutbox(user.id, {
          clientId: clientId.current,
          payload,
          label: `${data?.subModule.name} · ${formatDateLong(date)}`,
          queuedAt: new Date().toISOString(),
        });
        setConfirmOpen(false);
        if (saved) {
          removeLocal(key);
          setResult({ id: null, offline: true });
          setStep("done");
        } else toast.error("You're offline and this device couldn't store the attendance. Keep this page open and try again.");
      } else if (e instanceof ApiClientError && e.code === "already_exists") {
        setConfirmOpen(false);
        setExisting((e.data.existingId as string) ?? null);
      } else if (e instanceof ApiClientError && e.code === "list_changed") {
        setConfirmOpen(false);
        toast.error(e.message);
        await mutate();
        setStep("mark");
      } else toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function nextSessionLabel() {
    const idx = SESSION_LABELS.indexOf(sessionLabel);
    const next = idx >= 0 && idx < SESSION_LABELS.length - 1 ? SESSION_LABELS[idx + 1] : `Session ${Date.now() % 1000}`;
    setSessionLabel(next);
    setExisting(null);
    toast.info(`Recording as ${next}. Apply again to continue.`);
  }

  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />;
  if (isLoading || !data)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      </div>
    );

  const header = (
    <div className="flex flex-col gap-1">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-fg-muted">
        <Link href={`/modules/${data.mainModule.id}`} className="hover:text-fg">
          {data.mainModule.name}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/modules/${data.mainModule.id}/${data.subModule.id}`} className="hover:text-fg">
          {data.subModule.name}
        </Link>
      </nav>
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
        {step === "review" ? "Attendance review" : step === "done" ? "Attendance submitted" : data.subModule.name}
      </h1>
      <p className="text-sm text-fg-muted">
        {formatDateLong(date)} · {formatTime12(time)}
        {sessionLabel !== "Session 1" && ` · ${sessionLabel}`}
      </p>
    </div>
  );

  if (!total)
    return (
      <div className="grid gap-6">
        {header}
        <Card>
          <EmptyState
            icon={Users}
            title="No students in this class yet"
            description="Upload the class list to generate the roll-number grid automatically."
            actions={
              <LinkButton href={`/modules/${data.mainModule.id}/${data.subModule.id}?tab=students`}>Manage student data</LinkButton>
            }
          />
        </Card>
      </div>
    );

  const report = {
    date,
    time,
    mainModuleName: data.mainModule.name,
    subModuleName: data.subModule.name,
    sessionLabel,
    records: students.map((s) => ({ rollNumber: s.rollNumber, name: s.name, status: absent.has(s.id) ? ("absent" as const) : ("present" as const) })),
  };

  /* ------------------------------- DONE ------------------------------- */
  if (step === "done" && result)
    return (
      <div className="mx-auto grid max-w-2xl gap-6">
        <Card className="p-6 text-center sm:p-10">
          {result.offline ? (
            <CloudOff className="mx-auto size-12 text-warning" aria-hidden />
          ) : (
            <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
          )}
          <h1 className="mt-4 text-xl font-semibold text-fg">
            {result.offline ? "Saved on this device" : "Attendance submitted successfully"}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {result.offline
              ? "You're offline. It will be submitted automatically when the connection returns — it is not on the server yet."
              : `${data.mainModule.name} · ${data.subModule.name} · ${formatDateLong(date)}`}
          </p>
          <div className="mt-6">
            <SummaryStats total={total} present={presentCount} absent={absentCount} />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => setShareOpen(true)} className="bg-[#25D366] text-[#08311a] hover:bg-[#1fbe5b] dark:text-[#08311a]">
              <MessageCircle /> Share on WhatsApp
            </Button>
            {result.id && (
              <LinkButton href={`/history/${result.id}`} variant="secondary" size="lg">
                <Eye /> View details
              </LinkButton>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <LinkButton href="/attendance" variant="ghost" size="sm">
              <ClipboardCheck /> Take another
            </LinkButton>
            <LinkButton href="/history" variant="ghost" size="sm">
              <History /> Attendance history
            </LinkButton>
          </div>
        </Card>
        <WhatsAppShareDialog open={shareOpen} onOpenChange={setShareOpen} report={report} />
      </div>
    );

  /* ------------------------------ REVIEW ------------------------------ */
  if (step === "review")
    return (
      <div className="grid gap-6">
        {header}
        <SummaryStats total={total} present={presentCount} absent={absentCount} />
        <StatusLists
          records={students.map((s) => ({ id: s.id, rollNumber: s.rollNumber, name: s.name, status: absent.has(s.id) ? "absent" : "present" }))}
        />
        <div className="no-print sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep("mark")}>
              <ArrowLeft /> Back to edit
            </Button>
            <Button size="lg" onClick={() => setConfirmOpen(true)}>
              <CheckCheck /> Submit attendance
            </Button>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
          <DialogContent title="Confirm attendance" size="sm">
            <DialogBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-fg-muted">Class</dt>
                <dd className="text-right font-medium text-fg">
                  {data.mainModule.name}
                  <br />
                  {data.subModule.name}
                </dd>
                <dt className="text-fg-muted">Date</dt>
                <dd className="text-right font-medium text-fg">{formatDateLong(date)}</dd>
                <dt className="text-fg-muted">Time</dt>
                <dd className="text-right font-medium text-fg">
                  {formatTime12(time)} · {sessionLabel}
                </dd>
                <dt className="text-fg-muted">Total</dt>
                <dd className="tabular text-right font-medium text-fg">{total}</dd>
                <dt className="text-fg-muted">Present</dt>
                <dd className="tabular text-right font-medium text-success">{presentCount}</dd>
                <dt className="text-fg-muted">Absent</dt>
                <dd className="tabular text-right font-medium text-absent">{absentCount}</dd>
              </dl>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={submit} loading={submitting}>
                {submitting ? "Saving attendance…" : "Confirm & Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ExistingDialog
          id={existing}
          onClose={() => setExisting(null)}
          subject={data.subModule.name}
          date={date}
          sessionLabel={sessionLabel}
          onNewSession={nextSessionLabel}
        />
      </div>
    );

  /* ------------------------------- MARK ------------------------------- */
  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {header}
        <div className="flex items-center gap-2 text-xs text-fg-muted" role="status" aria-live="polite">
          {draftState === "saving" && (
            <>
              <Save className="size-3.5 animate-pulse" aria-hidden /> Saving draft…
            </>
          )}
          {draftState === "saved" && (
            <>
              <Save className="size-3.5" aria-hidden /> Draft saved on this device
            </>
          )}
        </div>
      </div>

      {/* Sticky live stats */}
      <div className="sticky top-14 z-20 -mx-4 border-y border-border bg-bg/90 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:bg-card/95 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <dl className="flex items-center gap-4 text-sm sm:gap-6" aria-live="polite">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-fg-muted">Total</dt>
              <dd className="tabular font-semibold text-fg">{total}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-fg-muted">Present</dt>
              <dd className="tabular font-semibold text-success">{presentCount}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-fg-muted">Absent</dt>
              <dd className="tabular font-semibold text-absent">{absentCount}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only text-fg-muted sm:not-sr-only">Attendance</dt>
              <dd className="tabular font-semibold text-fg">{percent(presentCount, total)}%</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Session details + tools */}
      <details className="group rounded-2xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-fg">
          <span>
            Session details{" "}
            <span className="font-normal text-fg-muted">
              · {formatDateLong(date)}, {formatTime12(time)}, {sessionLabel}
            </span>
          </span>
          <ChevronRight className="size-4 text-fg-muted transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-[13px] font-medium text-fg">
            Date
            <Input type="date" value={date} max={todayISO()} onChange={(e) => (setDate(e.target.value), setDirty(true))} />
          </label>
          <label className="grid gap-1.5 text-[13px] font-medium text-fg">
            Time
            <Input type="time" value={time} onChange={(e) => (setTime(e.target.value), setDirty(true))} />
          </label>
          <label className="grid gap-1.5 text-[13px] font-medium text-fg">
            Session
            <Select value={sessionLabel} onChange={(e) => (setSessionLabel(e.target.value), setDirty(true))}>
              {(SESSION_LABELS.includes(sessionLabel) ? SESSION_LABELS : [sessionLabel, ...SESSION_LABELS]).map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </label>
        </div>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search student name or roll number" className="sm:max-w-xs sm:flex-1" />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort students" className="h-9 w-40 text-[13px]">
            <option value="roll">Roll number</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="status">Status</option>
          </Select>
          <Button variant="secondary" size="sm" onClick={() => (setAbsent(new Set()), setDirty(true))}>
            <CheckCheck /> Mark all present
          </Button>
          <Button variant="secondary" size="sm" onClick={markAllAbsent}>
            <UserX /> Mark all absent
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (absent.size && !(await confirm({ title: "Reset marks?", description: "Everyone goes back to present.", confirmLabel: "Reset" }))) return;
              setAbsent(new Set());
              setQ("");
              setSort("roll");
            }}
          >
            <RotateCcw /> Reset
          </Button>
        </div>
      </div>

      <p className="text-xs text-fg-muted">Everyone starts present. Tap a student to mark them absent; tap again to undo.</p>

      {visible.length ? (
        <AttendanceGrid students={visible} absent={absent} onToggle={toggle} view={view} width={width} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-fg-muted">No students match “{q}”.</p>
      )}

      {/* Bottom action bar */}
      <div className="no-print sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="tabular font-semibold text-absent">{absentCount}</span>
            <span className="text-fg-muted"> absent · </span>
            <span className="tabular font-semibold text-success">{presentCount}</span>
            <span className="text-fg-muted"> present</span>
          </div>
          <Button size="lg" onClick={apply} loading={checking} className="min-w-40">
            Apply Section <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Restore draft */}
      <Dialog open={!!restore} onOpenChange={(o) => !o && setRestore(null)}>
        <DialogContent title="Unsaved attendance found" size="sm" hideClose>
          <DialogBody className="text-sm text-fg-muted">
            {restore && (
              <>
                You have a draft for {data.subModule.name} on {formatDateLong(restore.date)} with{" "}
                <strong className="text-fg">{restore.absentIds.length} absent</strong>. Restore your previous attendance?
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                removeLocal(key);
                setRestore(null);
              }}
            >
              Discard
            </Button>
            <Button
              onClick={() => {
                if (!restore) return;
                const ids = new Set(students.map((s) => s.id));
                const kept = restore.absentIds.filter((id) => ids.has(id));
                setAbsent(new Set(kept));
                setDate(restore.date);
                setTime(restore.time);
                setSessionLabel(restore.sessionLabel);
                setDirty(true);
                if (kept.length < restore.absentIds.length) toast.info("Some students in the draft are no longer in this class.");
                setRestore(null);
              }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExistingDialog id={existing} onClose={() => setExisting(null)} subject={data.subModule.name} date={date} sessionLabel={sessionLabel} onNewSession={nextSessionLabel} />
    </div>
  );

}

function ExistingDialog({
  id,
  onClose,
  subject,
  date,
  sessionLabel,
  onNewSession,
}: {
  id: string | null;
  onClose: () => void;
  subject: string;
  date: string;
  sessionLabel: string;
  onNewSession: () => void;
}) {
  const router = useRouter();
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Attendance already exists" size="sm">
        <DialogBody className="text-sm text-fg-muted">
          Attendance for <strong className="text-fg">{subject}</strong> on <strong className="text-fg">{formatDateLong(date)}</strong> ({sessionLabel}) has
          already been submitted.
        </DialogBody>
        <DialogFooter className="sm:flex-wrap">
          <Button variant="ghost" onClick={onNewSession}>
            Record as another session
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/history/${id}`)}>
            View existing
          </Button>
          <Button onClick={() => router.push(`/history/${id}?edit=1`)}>Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
