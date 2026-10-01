"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FilterX, History } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/misc";
import { SessionList } from "@/components/attendance/session-list";
import { errorMessage, useApi } from "@/lib/client/api";
import type { ModuleSummary, Session, SubModuleDetail } from "@/lib/client/types";
import { displayRoll } from "@/lib/roll";

const FILTERS = ["mainModuleId", "subModuleId", "date", "from", "to", "studentId", "status"] as const;

function HistoryInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const page = Number(params.get("page") ?? 1) || 1;

  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    router.replace(`${pathname}?${n.toString()}`, { scroll: false });
  };

  const { data: mods } = useApi<{ modules: ModuleSummary[] }>("/api/modules");
  const modules = mods?.modules ?? [];
  const subs = modules.filter((m) => !get("mainModuleId") || m.id === get("mainModuleId")).flatMap((m) => m.subModules);
  const { data: subDetail } = useApi<SubModuleDetail>(get("subModuleId") ? `/api/submodules/${get("subModuleId")}` : null);

  const query = new URLSearchParams();
  FILTERS.forEach((k) => get(k) && query.set(k, get(k)));
  query.set("page", String(page));
  const { data, error, isLoading, mutate } = useApi<{ sessions: Session[]; total: number; pages: number }>(`/api/attendance?${query}`);
  const active = FILTERS.some((k) => get(k));

  return (
    <>
      <PageHeader title="Attendance History" description="Every submitted session, with the names and roll numbers recorded at the time." />
      <Card className="mb-5 p-4">
        <details className="group sm:hidden" open={active || undefined}>
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-fg">
            Filters{active ? " (active)" : ""}
            <ChevronRight className="size-4 text-fg-muted transition-transform group-open:rotate-90" aria-hidden />
          </summary>
        </details>
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4 [details[open]+&]:mt-3 [details[open]+&]:grid">
          <label className="grid gap-1 text-xs font-medium text-fg-muted">
            Main module
            <Select value={get("mainModuleId")} onChange={(e) => set({ mainModuleId: e.target.value, subModuleId: "", studentId: "" })}>
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-fg-muted">
            Sub module
            <Select value={get("subModuleId")} onChange={(e) => set({ subModuleId: e.target.value, studentId: "" })}>
              <option value="">All sub modules</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-fg-muted">
            From
            <Input type="date" value={get("from") || get("date")} onChange={(e) => set({ from: e.target.value, date: "" })} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-fg-muted">
            To
            <Input type="date" value={get("to") || get("date")} onChange={(e) => set({ to: e.target.value, date: "" })} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-fg-muted">
            Student
            <Select
              value={get("studentId")}
              disabled={!subDetail}
              onChange={(e) => set({ studentId: e.target.value })}
              title={!subDetail ? "Choose a sub module first" : undefined}
            >
              <option value="">{subDetail ? "All students" : "Choose a sub module first"}</option>
              {subDetail?.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {displayRoll(s.rollNumber)} — {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-fg-muted">
            Status
            <Select value={get("status")} disabled={!get("studentId")} onChange={(e) => set({ status: e.target.value })}>
              <option value="">Present or absent</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </Select>
          </label>
          <div className="flex items-end">
            {active && (
              <Button variant="ghost" onClick={() => router.replace(pathname)}>
                <FilterX /> Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading ? (
        <Card className="grid gap-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !data?.sessions.length ? (
        <Card>
          <EmptyState
            icon={History}
            title={active ? "No matching records" : "No attendance records"}
            description={active ? "Try a different date range or module." : "Your submitted attendance sessions will appear here."}
            actions={!active && <LinkButton href="/attendance">Take attendance</LinkButton>}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <SessionList sessions={data.sessions} />
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-fg-muted">
            <span>
              {data.total} {data.total === 1 ? "session" : "sessions"}
            </span>
            {data.pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
                  <ChevronLeft /> Previous
                </Button>
                <span>
                  Page {page} of {data.pages}
                </span>
                <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => set({ page: String(page + 1) })}>
                  Next <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function HistoryPage() {
  return (
    <React.Suspense>
      <HistoryInner />
    </React.Suspense>
  );
}
