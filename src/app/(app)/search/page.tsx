"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, FolderKanban, Layers, Search as SearchIcon, User } from "lucide-react";
import { Card, EmptyState, PageHeader, SearchInput, Skeleton, Badge, useDebounced } from "@/components/ui/misc";
import { useApi } from "@/lib/client/api";
import type { Session } from "@/lib/client/types";
import { displayRoll } from "@/lib/roll";
import { formatDateLong } from "@/lib/utils";

type Results = {
  modules: { id: string; name: string; color: string }[];
  subModules: { id: string; name: string; mainModuleName: string }[];
  students: { id: string; name: string; rollNumber: string; status: string; subModuleId: string | null; context: string }[];
  sessions: Session[];
};

function Group({ title, icon: Icon, children, count }: { title: string; icon: React.ElementType; children: React.ReactNode; count: number }) {
  if (!count) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        <Icon className="size-3.5" aria-hidden /> {title} <span className="font-normal">({count})</span>
      </h2>
      <Card className="divide-y divide-border overflow-hidden">{children}</Card>
    </section>
  );
}

const rowCls = "flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/60";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const dq = useDebounced(q.trim(), 250);
  React.useEffect(() => {
    router.replace(dq ? `${pathname}?q=${encodeURIComponent(dq)}` : pathname, { scroll: false });
  }, [dq, pathname, router]);
  const { data, isLoading } = useApi<Results>(dq ? `/api/search?q=${encodeURIComponent(dq)}` : null);
  const total = data ? data.modules.length + data.subModules.length + data.students.length + data.sessions.length : 0;

  return (
    <>
      <PageHeader title="Search" description="Modules, sub modules, students (name or roll number) and attendance records." />
      <SearchInput value={q} onChange={setQ} placeholder="Type a name, roll number, subject or date (2026-10-01)" autoFocus className="mb-6 max-w-xl" />
      {!dq ? (
        <Card>
          <EmptyState icon={SearchIcon} title="Search your workspace" description="Tip: press Ctrl K anywhere to jump to search." />
        </Card>
      ) : isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !total ? (
        <Card>
          <EmptyState icon={SearchIcon} title="No results" description={`Nothing matches “${dq}”.`} />
        </Card>
      ) : (
        <div className="grid gap-6">
          <Group title="Students" icon={User} count={data!.students.length}>
            {data!.students.map((s) => (
              <Link key={s.id} href={s.subModuleId ? `/attendance/${s.subModuleId}` : `/students`} className={rowCls}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="tabular font-mono text-[13px] font-semibold text-fg">{displayRoll(s.rollNumber)}</span>
                  <span className="truncate text-fg">{s.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
                  {s.status === "inactive" && <Badge>Deactivated</Badge>}
                  {s.context}
                </span>
              </Link>
            ))}
          </Group>
          <Group title="Main modules" icon={FolderKanban} count={data!.modules.length}>
            {data!.modules.map((m) => (
              <Link key={m.id} href={`/modules/${m.id}`} className={rowCls}>
                <span className="flex items-center gap-2 text-fg">
                  <span className="size-2.5 rounded-full" style={{ background: m.color }} aria-hidden /> {m.name}
                </span>
              </Link>
            ))}
          </Group>
          <Group title="Sub modules" icon={Layers} count={data!.subModules.length}>
            {data!.subModules.map((s) => (
              <Link key={s.id} href={`/attendance/${s.id}`} className={rowCls}>
                <span className="text-fg">{s.name}</span>
                <span className="text-xs text-fg-muted">{s.mainModuleName}</span>
              </Link>
            ))}
          </Group>
          <Group title="Attendance records" icon={CalendarCheck} count={data!.sessions.length}>
            {data!.sessions.map((s) => (
              <Link key={s.id} href={`/history/${s.id}`} className={rowCls}>
                <span className="text-fg">{formatDateLong(s.date)}</span>
                <span className="truncate text-xs text-fg-muted">
                  {s.mainModuleName} · {s.subModuleName} · {s.present}/{s.total} present
                </span>
              </Link>
            ))}
          </Group>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense>
      <SearchInner />
    </React.Suspense>
  );
}
