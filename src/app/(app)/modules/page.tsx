"use client";
import * as React from "react";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, Card } from "@/components/ui/misc";
import { MainModuleCard } from "@/components/modules/module-cards";
import { useModuleActions } from "@/components/modules/use-module-actions";
import { errorMessage, useApi } from "@/lib/client/api";
import type { ModuleSummary } from "@/lib/client/types";

export default function ModulesPage() {
  const { data, error, isLoading, mutate } = useApi<{ modules: ModuleSummary[] }>("/api/modules");
  const modules = data?.modules ?? [];
  const { actions, dialogs } = useModuleActions(modules, () => mutate());
  const [q, setQ] = React.useState("");
  const shown = modules.filter(
    (m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.subModules.some((s) => s.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Modules"
        description="Main modules are your classes. Each holds sub modules (subjects) with their own student lists."
        actions={
          <>
            <Button variant="secondary" onClick={() => actions.createSub()} disabled={!modules.length}>
              <Plus /> Sub module
            </Button>
            <Button onClick={actions.createMain}>
              <Plus /> Create Main Module
            </Button>
          </>
        }
      />
      {modules.length > 3 && <SearchInput value={q} onChange={setQ} placeholder="Search modules and subjects" className="mb-5 max-w-sm" />}
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : !modules.length ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="No modules yet"
            description="Create your first class module, then add subjects and upload the student list."
            actions={
              <Button onClick={actions.createMain}>
                <Plus /> Create Main Module
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => (
            <MainModuleCard
              key={m.id}
              module={m}
              onTakeAttendance={() => actions.takeAttendance(m)}
              onCreateSub={() => actions.createSub(m.id)}
              onEdit={() => actions.editMain(m)}
              onDuplicate={() => actions.duplicateMain(m)}
              onDelete={() => actions.deleteMain(m)}
            />
          ))}
          {!shown.length && <p className="text-sm text-fg-muted">No modules match “{q}”.</p>}
        </div>
      )}
      {dialogs}
    </>
  );
}
