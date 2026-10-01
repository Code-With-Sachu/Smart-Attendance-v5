"use client";
import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  FolderKanban,
  Percent,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, ErrorState, SearchInput, Skeleton, StatCard } from "@/components/ui/misc";
import { SessionList } from "@/components/attendance/session-list";
import { TrendBars } from "@/components/charts/trend-bars";
import { useUser } from "@/components/layout/user-context";
import { errorMessage, useApi } from "@/lib/client/api";
import type { ModuleSummary, Session } from "@/lib/client/types";
import { formatDateLong, greeting, pluralize, relativeDay, todayISO } from "@/lib/utils";

type Stats = {
  totals: { modules: number; subModules: number; students: number; todaysSessions: number; averageAttendance: number | null };
  modules: ModuleSummary[];
  today: Session[];
  recent: Session[];
  trend: { date: string; rate: number }[];
};

export default function HomePage() {
  const { user } = useUser();
  const today = todayISO();
  const { data, error, isLoading, mutate } = useApi<Stats>(`/api/stats?today=${today}`);
  const [q, setQ] = React.useState("");
  const [hello, setHello] = React.useState("Welcome");
  React.useEffect(() => setHello(greeting()), []);

  const subs = (data?.modules ?? []).flatMap((m) => m.subModules.map((s) => ({ ...s, module: m })));
  const needle = q.toLowerCase();
  const quick = subs.filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.module.name.toLowerCase().includes(needle)).slice(0, 8);
  const pendingToday = subs.filter((s) => s.studentCount > 0 && s.lastAttendance !== today);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {hello}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{formatDateLong(today)}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/modules" variant="secondary">
            <FolderKanban /> Modules
          </LinkButton>
          <LinkButton href="/attendance">
            <ClipboardCheck /> Take Attendance
          </LinkButton>
        </div>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : !data.totals.modules ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="Let's set up your first class"
            description="1. Create a main module (e.g. CSE S3). 2. Add a subject. 3. Upload the student spreadsheet. Then you're ready to take attendance."
            actions={
              <LinkButton href="/modules">
                <Plus /> Create Main Module
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Total Modules" value={data.totals.modules} icon={FolderKanban} hint={pluralize(data.totals.subModules, "sub module")} />
            <StatCard label="Total Students" value={data.totals.students} icon={Users} hint="Across your classes" />
            <StatCard label="Today's Sessions" value={data.totals.todaysSessions} icon={CalendarCheck} hint={pendingToday.length ? `${pendingToday.length} classes not taken yet` : "All caught up"} />
            <StatCard
              label="Average Attendance"
              value={data.totals.averageAttendance === null ? "—" : `${data.totals.averageAttendance}%`}
              icon={Percent}
              hint="Last 30 days"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader
                title="Quick attendance"
                description="Jump straight into a class."
                action={<SearchInput value={q} onChange={setQ} placeholder="Find class" className="hidden w-48 sm:block" />}
              />
              <ul className="mt-3 divide-y divide-border">
                {quick.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.studentCount ? `/attendance/${s.id}` : `/modules/${s.module.id}/${s.id}?tab=students`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60"
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.module.color }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{s.name}</span>
                        <span className="block text-xs text-fg-muted">
                          {s.module.name} · {s.studentCount ? pluralize(s.studentCount, "student") : "No students"}
                        </span>
                      </span>
                      {s.lastAttendance === today ? (
                        <Badge tone="success">Done today</Badge>
                      ) : s.studentCount ? (
                        <span className="hidden text-xs text-fg-muted sm:inline">Last: {relativeDay(s.lastAttendance)}</span>
                      ) : (
                        <Badge tone="warning">
                          <Upload /> Add students
                        </Badge>
                      )}
                      <ArrowRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
                {!quick.length && <li className="px-5 py-6 text-center text-sm text-fg-muted">No classes match.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Attendance trend" description="Daily attendance rate, last 14 days with classes" />
              <div className="p-5 pt-4">
                {data.trend.length ? (
                  <TrendBars data={data.trend} />
                ) : (
                  <EmptyState className="py-8" icon={BarChart3} title="No data yet" description="The trend appears after your first submitted session." />
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="Recent sessions"
              action={
                <Link href="/history" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              }
            />
            <div className="mt-3 border-t border-border">
              {data.recent.length ? (
                <SessionList sessions={data.recent} />
              ) : (
                <EmptyState className="py-10" icon={CalendarCheck} title="No attendance records" description="Your submitted attendance sessions will appear here." />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
