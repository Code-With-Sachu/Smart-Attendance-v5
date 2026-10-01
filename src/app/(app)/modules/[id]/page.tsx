"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ClipboardCheck, Copy, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { SubModuleCard } from "@/components/modules/module-cards";
import { useModuleActions } from "@/components/modules/use-module-actions";
import { errorMessage, useApi } from "@/lib/client/api";
import type { ModuleSummary } from "@/lib/client/types";
import { pluralize, relativeDay } from "@/lib/utils";

export default function ModuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useApi<{ modules: ModuleSummary[] }>("/api/modules");
  const modules = data?.modules ?? [];
  const mod = modules.find((m) => m.id === id);
  const { actions, dialogs } = useModuleActions(modules, () => mutate());

  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />;
  if (isLoading)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  if (!mod)
    return (
      <Card>
        <EmptyState icon={Layers} title="Module not found" description="It may have been deleted." actions={<Link href="/modules" className="text-sm font-medium text-primary">Back to modules</Link>} />
      </Card>
    );

  return (
    <>
      <PageHeader
        eyebrow={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1">
            <Link href="/modules" className="hover:text-fg">
              Modules
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page">{mod.name}</span>
          </nav>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="inline-block size-3 rounded-full" style={{ background: mod.color }} aria-hidden />
            {mod.name}
          </span>
        }
        description={`Module ${mod.number} · ${pluralize(mod.subModuleCount, "sub module")} · Last attendance: ${relativeDay(mod.lastAttendance)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => actions.createSub(mod.id)}>
              <Plus /> Create Sub Module
            </Button>
            <Button onClick={() => actions.takeAttendance(mod)} disabled={!mod.subModules.length}>
              <ClipboardCheck /> Take Attendance
            </Button>
            <MoreMenu
              items={[
                { label: "Edit", icon: Pencil, onSelect: () => actions.editMain(mod) },
                { label: "Duplicate", icon: Copy, onSelect: () => actions.duplicateMain(mod) },
                { type: "separator" },
                {
                  label: "Delete",
                  icon: Trash2,
                  danger: true,
                  onSelect: async () => {
                    if (await actions.deleteMain(mod)) router.push("/modules");
                  },
                },
              ]}
            />
          </>
        }
      />
      {!mod.subModules.length ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="No sub modules yet"
            description="Add a subject such as Data Structures. Each sub module gets its own student list and attendance history."
            actions={
              <Button onClick={() => actions.createSub(mod.id)}>
                <Plus /> Create Sub Module
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mod.subModules.map((s) => (
            <SubModuleCard
              key={s.id}
              sub={s}
              color={mod.color}
              onEdit={() => actions.editSub(s)}
              onCreateSub={() => actions.createSub(mod.id)}
              onDelete={() => actions.deleteSub(s)}
            />
          ))}
        </div>
      )}
      {dialogs}
    </>
  );
}
