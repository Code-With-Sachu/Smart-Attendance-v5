"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Layers } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { ModuleSummary, SubModuleSummary } from "@/lib/client/types";
import { MainModuleDialog, SubModuleDialog } from "./module-dialogs";
import { pluralize, relativeDay } from "@/lib/utils";

/** Shared create/edit/duplicate/delete/take-attendance behaviour for module screens. */
export function useModuleActions(modules: ModuleSummary[], reload: () => void) {
  const router = useRouter();
  const confirm = useConfirm();
  const [mainDialog, setMainDialog] = React.useState<{ open: boolean; module: ModuleSummary | null }>({ open: false, module: null });
  const [subDialog, setSubDialog] = React.useState<{ open: boolean; mainId?: string; sub: SubModuleSummary | null }>({ open: false, sub: null });
  const [picker, setPicker] = React.useState<ModuleSummary | null>(null);

  const actions = {
    createMain: () => setMainDialog({ open: true, module: null }),
    editMain: (m: ModuleSummary) => setMainDialog({ open: true, module: m }),
    createSub: (mainId?: string) => setSubDialog({ open: true, mainId, sub: null }),
    editSub: (s: SubModuleSummary) => setSubDialog({ open: true, mainId: s.mainModuleId, sub: s }),
    takeAttendance: (m: ModuleSummary) => {
      if (m.subModules.length === 1) router.push(`/attendance/${m.subModules[0].id}`);
      else if (!m.subModules.length) {
        toast.info("Create a sub module first — each sub module has its own student list.");
        setSubDialog({ open: true, mainId: m.id, sub: null });
      } else setPicker(m);
    },
    duplicateMain: async (m: ModuleSummary) => {
      try {
        const r = await apiFetch<{ id: string }>(`/api/modules/${m.id}/duplicate`, { method: "POST" });
        toast.success(`Duplicated ${m.name}`);
        reload();
        router.push(`/modules/${r.id}`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    deleteMain: async (m: ModuleSummary) => {
      const ok = await confirm({
        title: `Delete ${m.name}?`,
        description: (
          <>
            This removes the module and its {pluralize(m.subModuleCount, "sub module")} from your workspace. Submitted attendance
            stays in Attendance History.
          </>
        ),
        confirmLabel: "Delete module",
        tone: "danger",
      });
      if (!ok) return false;
      try {
        await apiFetch(`/api/modules/${m.id}`, { method: "DELETE" });
        toast.success(`${m.name} deleted`);
        reload();
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      }
    },
    deleteSub: async (s: SubModuleSummary) => {
      const ok = await confirm({
        title: `Delete ${s.name}?`,
        description: "The sub module will be removed. Submitted attendance stays in Attendance History.",
        confirmLabel: "Delete sub module",
        tone: "danger",
      });
      if (!ok) return false;
      try {
        await apiFetch(`/api/submodules/${s.id}`, { method: "DELETE" });
        toast.success(`${s.name} deleted`);
        reload();
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      }
    },
  };

  const nextNumber = Math.max(0, ...modules.map((m) => m.number)) + 1;
  const dialogs = (
    <>
      <MainModuleDialog
        open={mainDialog.open}
        onOpenChange={(o) => setMainDialog((d) => ({ ...d, open: o }))}
        module={mainDialog.module}
        nextNumber={nextNumber}
        onSaved={(id) => {
          reload();
          if (!mainDialog.module) router.push(`/modules/${id}`);
        }}
      />
      <SubModuleDialog
        open={subDialog.open}
        onOpenChange={(o) => setSubDialog((d) => ({ ...d, open: o }))}
        modules={modules}
        defaultMainId={subDialog.mainId}
        subModule={subDialog.sub}
        onSaved={() => reload()}
      />
      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent title="Take attendance" description={picker ? `Choose a sub module in ${picker.name}.` : undefined} size="sm">
          <DialogBody className="grid gap-2">
            {picker?.subModules.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/attendance/${s.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary hover:bg-primary-soft"
              >
                <Layers className="size-5 shrink-0" style={{ color: picker.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{s.name}</span>
                  <span className="block text-xs text-fg-muted">
                    {pluralize(s.studentCount, "student")} · Last: {relativeDay(s.lastAttendance)}
                  </span>
                </span>
                <ClipboardCheck className="size-4 text-fg-muted" aria-hidden />
              </button>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
  return { actions, dialogs };
}
