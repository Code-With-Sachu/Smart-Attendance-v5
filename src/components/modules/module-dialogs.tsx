"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/client/api";
import { cn, MODULE_COLORS } from "@/lib/utils";
import type { ModuleSummary } from "@/lib/client/types";

function issuesToMap(e: unknown) {
  const map: Record<string, string> = {};
  if (e instanceof ApiClientError && e.code === "validation") {
    ((e.data.issues as { path: string[]; message: string }[]) ?? []).forEach((i) => (map[i.path[0]] ??= i.message));
  }
  return map;
}

export function MainModuleDialog({
  open,
  onOpenChange,
  module,
  onSaved,
  nextNumber = 1,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  module?: Pick<ModuleSummary, "id" | "name" | "number" | "color"> | null;
  onSaved: (id: string) => void;
  nextNumber?: number;
}) {
  const [color, setColor] = React.useState(module?.color ?? MODULE_COLORS[0]);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setColor(module?.color ?? MODULE_COLORS[0]);
      setErrors({});
      setError(null);
    }
  }, [open, module]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { name: f.get("name"), number: f.get("number"), color };
    setLoading(true);
    setErrors({});
    setError(null);
    try {
      const r = module
        ? (await apiFetch(`/api/modules/${module.id}`, { method: "PATCH", body }), { id: module.id })
        : await apiFetch<{ id: string }>("/api/modules", { body });
      toast.success(module ? "Module updated" : "Module created");
      onSaved(r.id);
      onOpenChange(false);
    } catch (err) {
      const m = issuesToMap(err);
      if (Object.keys(m).length) setErrors(m);
      else if (err instanceof ApiClientError && err.code === "duplicate_name") setErrors({ name: err.message });
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={module ? "Edit main module" : "Create main module"} description="A main module is a class or group, e.g. CSE S3." size="sm">
        <form onSubmit={submit} noValidate>
          <DialogBody className="grid gap-4">
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Field label="Module name" error={errors.name}>
              <Input name="name" defaultValue={module?.name ?? ""} placeholder="e.g. CSE S3" required autoFocus maxLength={60} />
            </Field>
            <Field label="Module number" error={errors.number} hint="Used for ordering, e.g. the semester.">
              <Input name="number" type="number" min={1} defaultValue={module?.number ?? nextNumber} required inputMode="numeric" />
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-fg">Color</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Module color">
                {MODULE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition",
                      color === c && "ring-2 ring-fg",
                    )}
                    style={{ background: c }}
                  >
                    {color === c && <Check className="size-4 text-white" aria-hidden />}
                  </button>
                ))}
              </div>
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {module ? "Save changes" : "Create module"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubModuleDialog({
  open,
  onOpenChange,
  modules,
  defaultMainId,
  subModule,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  modules: Pick<ModuleSummary, "id" | "name">[];
  defaultMainId?: string;
  subModule?: { id: string; name: string; code: string } | null;
  onSaved: (id: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setErrors({});
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setErrors({});
    setError(null);
    try {
      let id = subModule?.id ?? "";
      if (subModule) await apiFetch(`/api/submodules/${subModule.id}`, { method: "PATCH", body: { name: f.get("name"), code: f.get("code") } });
      else
        id = (
          await apiFetch<{ id: string }>("/api/submodules", {
            body: { mainModuleId: f.get("mainModuleId"), name: f.get("name"), code: f.get("code") },
          })
        ).id;
      toast.success(subModule ? "Sub module updated" : "Sub module created");
      onSaved(id);
      onOpenChange(false);
    } catch (err) {
      const m = issuesToMap(err);
      if (Object.keys(m).length) setErrors(m);
      else if (err instanceof ApiClientError && err.code === "duplicate_name") setErrors({ name: err.message });
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={subModule ? "Edit sub module" : "Create sub module"}
        description="A sub module is a subject or batch with its own student list and attendance."
        size="sm"
      >
        <form onSubmit={submit} noValidate>
          <DialogBody className="grid gap-4">
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            {!subModule && (
              <Field label="Main module" error={errors.mainModuleId}>
                <Select name="mainModuleId" defaultValue={defaultMainId ?? modules[0]?.id} required>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Sub module name" error={errors.name}>
              <Input name="name" defaultValue={subModule?.name ?? ""} placeholder="e.g. Data Structures" required autoFocus maxLength={80} />
            </Field>
            <Field label="Course code" optional error={errors.code}>
              <Input name="code" defaultValue={subModule?.code ?? ""} placeholder="e.g. CST201" maxLength={20} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {subModule ? "Save changes" : "Create sub module"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
