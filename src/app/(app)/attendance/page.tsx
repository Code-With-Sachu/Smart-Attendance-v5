"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, FolderKanban, Plus } from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, Badge } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { errorMessage, useApi } from "@/lib/client/api";
import type { ModuleSummary } from "@/lib/client/types";
import { pluralize, relativeDay, todayISO } from "@/lib/utils";

/** Pick a class: Main Module → Sub Module → grid. */
export default function AttendancePickerPage() {
  const { data, error, isLoading, mutate } = useApi<{ modules: ModuleSummary[] }>("/api/modules");
  const [q, setQ] = React.useState("");
  const modules = data?.modules ?? [];
  const needle = q.toLowerCase();
  const today = todayISO();

  return (
    <>
      <PageHeader title="Take Attendance" description="Choose a class. Everyone starts present — you only tap the absentees." />
      {modules.length > 0 && <SearchInput value={q} onChange={setQ} placeholder="Find a module or subject" className="mb-5 max-w-sm" />}
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !modules.length ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="No modules yet"
            description="Create a class module and upload your student list to start taking attendance."
            actions={
              <LinkButton href="/modules">
                <Plus /> Create Main Module
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5">
          {modules
            .map((m) => ({
              ...m,
              subModules: m.subModules.filter((s) => !needle || s.name.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle)),
            }))
            .filter((m) => m.subModules.length || (!needle && true))
            .map((m) => (
              <section key={m.id} aria-labelledby={`m-${m.id}`}>
                <h2 id={`m-${m.id}`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                  <span className="size-2.5 rounded-full" style={{ background: m.color }} aria-hidden />
                  {m.name}
                </h2>
                {m.subModules.length ? (
                  <Card className="divide-y divide-border overflow-hidden">
                    {m.subModules.map((s) => {
                      const doneToday = s.lastAttendance === today;
                      return (
                        <Link
                          key={s.id}
                          href={s.studentCount ? `/attendance/${s.id}` : `/modules/${m.id}/${s.id}?tab=students`}
                          className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                            <ClipboardCheck className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-fg">{s.name}</div>
                            <div className="text-xs text-fg-muted">
                              {s.studentCount ? pluralize(s.studentCount, "student") : "No students yet — add them first"} · Last:{" "}
                              {relativeDay(s.lastAttendance)}
                            </div>
                          </div>
                          {doneToday && <Badge tone="success">Taken today</Badge>}
                          <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                        </Link>
                      );
                    })}
                  </Card>
                ) : (
                  <Card className="px-5 py-4 text-sm text-fg-muted">
                    No sub modules.{" "}
                    <Link href={`/modules/${m.id}`} className="font-medium text-primary hover:underline">
                      Add one
                    </Link>
                  </Card>
                )}
              </section>
            ))}
        </div>
      )}
    </>
  );
}
