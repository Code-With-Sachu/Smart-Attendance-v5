"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge, Card, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, useDebounced } from "@/components/ui/misc";
import { StudentManager } from "@/components/students/student-manager";
import { StudentDetailDialog } from "@/components/students/student-dialogs";
import { errorMessage, useApi } from "@/lib/client/api";
import type { Dataset, Student } from "@/lib/client/types";
import { displayRoll } from "@/lib/roll";

type DatasetRow = Dataset & { label: string };

function AllStudents({ datasets }: { datasets: DatasetRow[] }) {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [detail, setDetail] = React.useState<string | null>(null);
  const dq = useDebounced(q);
  React.useEffect(() => setPage(1), [dq]);
  const { data, error, isLoading, mutate } = useApi<{ students: Student[]; total: number; pages: number }>(
    `/api/students?q=${encodeURIComponent(dq)}&page=${page}&pageSize=50`,
  );
  const labels = new Map(datasets.map((d) => [d.id, d.label]));
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">All students</h2>
          <p className="text-sm text-fg-muted">{data ? `${data.total} students across your classes` : "Loading…"}</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search students…" className="sm:w-72" />
      </div>
      {error ? (
        <div className="p-5">
          <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-2 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : !data?.students.length ? (
        <EmptyState icon={Users} title={dq ? "No students found" : "No students yet"} description={dq ? `Nothing matches “${dq}”.` : "Choose a class above and upload a student file."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">All students</caption>
            <thead className="border-b border-border bg-muted/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="w-20 px-5 py-2.5 font-medium">Roll</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Module</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="tabular px-5 py-2.5 font-mono text-[13px] font-medium text-fg">{displayRoll(s.rollNumber)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setDetail(s.id)} className="text-left text-fg hover:text-primary hover:underline">
                      {s.name}
                    </button>
                    <div className="text-xs text-fg-muted md:hidden">{labels.get(s.datasetId)}</div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-fg-muted md:table-cell">{labels.get(s.datasetId) ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Deactivated"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.pages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 text-sm text-fg-muted">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft /> Previous
              </Button>
              Page {page} of {data.pages}
              <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
      <StudentDetailDialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)} studentId={detail} />
    </Card>
  );
}

function StudentsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, error, isLoading, mutate } = useApi<{ datasets: DatasetRow[]; profileDatasetId: string }>("/api/datasets");
  const datasets = data?.datasets ?? [];
  const selected = params.get("list") ?? "all";
  const current = datasets.find((d) => d.id === selected);
  const total = datasets.filter((d) => d.scope === "submodule").reduce((a, d) => a + d.studentCount, 0);

  return (
    <>
      <PageHeader title="Students" description={`${total} students in your classes. Upload a file to create or update a class list.`} />
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="list" className="text-sm font-medium text-fg">
              Class list
            </label>
            <Select id="list" value={selected} onChange={(e) => router.replace(`${pathname}?list=${e.target.value}`)} className="sm:w-80">
              <option value="all">All students (search)</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.studentCount})
                </option>
              ))}
            </Select>
            {datasets.length <= 1 && (
              <LinkButton href="/modules" variant="ghost" size="sm">
                Create a module to add class lists
              </LinkButton>
            )}
          </div>
          {current ? (
            <StudentManager
              key={current.id}
              datasetId={current.id}
              label={current.label}
              profileDatasetId={data?.profileDatasetId}
              onChanged={() => mutate()}
            />
          ) : (
            <AllStudents datasets={datasets} />
          )}
        </>
      )}
    </>
  );
}

export default function StudentsPage() {
  return (
    <React.Suspense>
      <StudentsInner />
    </React.Suspense>
  );
}
