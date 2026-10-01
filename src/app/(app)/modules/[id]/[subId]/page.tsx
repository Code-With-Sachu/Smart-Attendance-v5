"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, BarChart3, CalendarCheck, ChevronRight, ClipboardCheck, Download, FileSpreadsheet, History, Percent, Users } from "lucide-react";
import { LinkButton, Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Segmented, Skeleton, StatCard } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { StudentManager } from "@/components/students/student-manager";
import { SessionList } from "@/components/attendance/session-list";
import { useUser } from "@/components/layout/user-context";
import { errorMessage, useApi } from "@/lib/client/api";
import type { SubModuleDetail } from "@/lib/client/types";
import { displayRoll, rollWidth } from "@/lib/roll";
import { cn } from "@/lib/utils";

type Tab = "overview" | "students" | "history";

function SubModulePage() {
  const { subId } = useParams<{ id: string; subId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const tab = (params.get("tab") as Tab) || "overview";
  const { data, error, isLoading, mutate } = useApi<SubModuleDetail>(`/api/submodules/${subId}`);
  const { data: ds } = useApi<{ profileDatasetId: string }>("/api/datasets");
  const threshold = user.preferences.lowAttendanceThreshold;

  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />;
  if (isLoading || !data)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-14 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const active = data.students.filter((s) => s.status === "active");
  const w = rollWidth(active.map((s) => s.rollNumber));
  const low = active.filter((s) => s.percentage !== null && s.percentage < threshold);
  const label = `${data.mainModule.name} · ${data.subModule.name}`;

  return (
    <>
      <PageHeader
        eyebrow={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1">
            <Link href="/modules" className="hover:text-fg">
              Modules
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/modules/${data.mainModule.id}`} className="hover:text-fg">
              {data.mainModule.name}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page">{data.subModule.name}</span>
          </nav>
        }
        title={data.subModule.name}
        description={data.subModule.code ? `${data.subModule.code} · ${data.mainModule.name}` : data.mainModule.name}
        actions={
          <>
            <MoreMenu
              label="Export register"
              trigger={
                <Button variant="secondary">
                  <Download /> Export
                </Button>
              }
              items={[
                { label: "Register (CSV)", icon: Download, onSelect: () => (window.location.href = `/api/export?type=submodule&id=${subId}&format=csv`) },
                { label: "Register (Excel)", icon: FileSpreadsheet, onSelect: () => (window.location.href = `/api/export?type=submodule&id=${subId}&format=xlsx`) },
              ]}
            />
            {active.length > 0 && (
              <LinkButton href={`/attendance/${subId}`}>
                <ClipboardCheck /> Take Attendance
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-5 overflow-x-auto">
        <Segmented
          label="Sections"
          value={tab}
          onChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })}
          options={[
            { value: "overview", label: "Overview", icon: BarChart3 },
            { value: "students", label: `Students (${active.length})`, icon: Users },
            { value: "history", label: "History", icon: History },
          ]}
        />
      </div>

      {tab === "students" && (
        <StudentManager datasetId={data.subModule.datasetId} label={label} profileDatasetId={ds?.profileDatasetId} onChanged={() => mutate()} compactHeader />
      )}

      {tab === "history" && (
        <Card className="overflow-hidden">
          {data.analytics.recent.length ? (
            <>
              <SessionList sessions={data.analytics.recent} showModule={false} />
              <div className="border-t border-border px-5 py-3 text-right">
                <Link href={`/history?subModuleId=${subId}`} className="text-sm font-medium text-primary hover:underline">
                  View all in Attendance History
                </Link>
              </div>
            </>
          ) : (
            <EmptyState icon={History} title="No attendance records" description="Submitted sessions for this subject will appear here." />
          )}
        </Card>
      )}

      {tab === "overview" && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Total classes" value={data.analytics.totalClasses} icon={CalendarCheck} />
            <StatCard
              label="Average attendance"
              value={data.analytics.averageAttendance === null ? "—" : `${data.analytics.averageAttendance}%`}
              icon={Percent}
            />
            <StatCard label="Students" value={data.analytics.students} icon={Users} />
            <StatCard label={`Below ${threshold}%`} value={low.length} icon={AlertTriangle} hint={low.length ? "Need attention" : "All clear"} />
          </div>

          {!active.length ? (
            <Card>
              <EmptyState
                icon={Users}
                title="No students yet"
                description="Upload a student file or import a Google Sheet to start managing students."
                actions={<Button onClick={() => router.replace(`${pathname}?tab=students`)}>Manage student data</Button>}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardHeader
                title="Student attendance"
                description={data.analytics.totalClasses ? `Across ${data.analytics.totalClasses} classes` : "No classes recorded yet"}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Attendance per student</caption>
                  <thead className="border-y border-border bg-muted/60 text-xs text-fg-muted">
                    <tr>
                      <th scope="col" className="w-20 px-5 py-2.5 font-medium">Roll</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Present</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Absent</th>
                      <th scope="col" className="w-48 px-5 py-2.5 font-medium">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((s) => {
                      const lowS = s.percentage !== null && s.percentage < threshold;
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="tabular px-5 py-2.5 font-mono text-[13px] font-medium text-fg">{displayRoll(s.rollNumber, w)}</td>
                          <td className="px-3 py-2.5 text-fg">{s.name}</td>
                          <td className="tabular px-3 py-2.5 text-right text-fg">{s.present}</td>
                          <td className="tabular px-3 py-2.5 text-right text-fg">{s.absent}</td>
                          <td className="px-5 py-2.5">
                            {s.percentage === null ? (
                              <span className="text-fg-subtle">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                                  <div className={cn("h-full rounded-full", lowS ? "bg-warning" : "bg-primary")} style={{ width: `${s.percentage}%` }} />
                                </div>
                                <span className="tabular w-12 text-right text-[13px] font-medium text-fg">{s.percentage}%</span>
                                {lowS && (
                                  <Badge tone="warning" title={`Below ${threshold}%`}>
                                    <AlertTriangle /> Low
                                  </Badge>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <React.Suspense>
      <SubModulePage />
    </React.Suspense>
  );
}
