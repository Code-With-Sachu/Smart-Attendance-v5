"use client";
import * as React from "react";
import { Eye, EyeOff, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { apiFetch, ApiClientError, errorMessage, useApi } from "@/lib/client/api";
import type { Contact } from "@/lib/client/types";
import { formatPhone, maskPhone, normalizePhone } from "@/lib/phone";

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact: Contact | null;
  onSaved: () => void;
}) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => setErrors({}), [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""), label: String(f.get("label") ?? "") };
    const errs: Record<string, string> = {};
    if (!body.name.trim()) errs.name = "Enter a contact name";
    const p = normalizePhone(body.phone);
    if (!p.ok) errs.phone = p.reason;
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    try {
      if (contact) await apiFetch(`/api/contacts/${contact.id}`, { method: "PATCH", body });
      else await apiFetch("/api/contacts", { body });
      toast.success(contact ? "Contact updated" : "Contact saved");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError && (err.code === "duplicate_phone" || err.code === "invalid_phone")) setErrors({ phone: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={contact ? "Edit WhatsApp contact" : "Add WhatsApp contact"} size="sm">
        <form onSubmit={submit} noValidate>
          <DialogBody className="grid gap-4">
            <Field label="Name" error={errors.name}>
              <Input name="name" defaultValue={contact?.name} placeholder="e.g. Anjali (CR)" autoFocus required />
            </Field>
            <Field label="WhatsApp number" error={errors.phone} hint="Include the country code, e.g. +91 98765 43210. 10-digit numbers default to +91.">
              <Input name="phone" type="tel" defaultValue={contact ? `+${contact.phone}` : ""} placeholder="+91 98765 43210" inputMode="tel" autoComplete="off" required />
            </Field>
            <Field label="Label" optional error={errors.label}>
              <Input name="label" defaultValue={contact?.label} placeholder="e.g. Class Representative" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppContacts() {
  const confirm = useConfirm();
  const { data, isLoading, mutate } = useApi<{ contacts: Contact[] }>("/api/contacts");
  const [dialog, setDialog] = React.useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [revealed, setRevealed] = React.useState<Set<string>>(new Set());
  const contacts = data?.contacts ?? [];

  async function remove(c: Contact) {
    if (!(await confirm({ title: `Delete ${c.name}?`, description: "This contact will no longer appear when sharing reports.", confirmLabel: "Delete", tone: "danger" })))
      return;
    try {
      await apiFetch(`/api/contacts/${c.id}`, { method: "DELETE" });
      toast.success("Contact deleted");
      mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="grid gap-3">
      {isLoading ? (
        <Skeleton className="h-20" />
      ) : !contacts.length ? (
        <EmptyState
          className="py-8"
          icon={MessageCircle}
          title="No saved numbers"
          description="Save the people you send attendance to — class representatives, HOD, parent group admins."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {contacts.map((c) => {
            const shown = revealed.has(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C4B] dark:text-[#25D366]">
                  <MessageCircle className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{c.label || c.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                    {c.label && <span className="truncate">{c.name} ·</span>}
                    <span className="tabular font-mono">{shown ? formatPhone(c.phone) : maskPhone(c.phone)}</span>
                    <button
                      onClick={() =>
                        setRevealed((r) => {
                          const n = new Set(r);
                          if (n.has(c.id)) n.delete(c.id);
                          else n.add(c.id);
                          return n;
                        })
                      }
                      className="rounded p-0.5 hover:bg-muted hover:text-fg"
                      aria-label={shown ? "Hide number" : "Show number"}
                    >
                      {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>
                <MoreMenu
                  label={`Actions for ${c.name}`}
                  items={[
                    { label: "Edit", icon: Pencil, onSelect: () => setDialog({ open: true, contact: c }) },
                    { label: "Delete", icon: Trash2, onSelect: () => remove(c), danger: true },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div>
        <Button variant="secondary" onClick={() => setDialog({ open: true, contact: null })}>
          <Plus /> Add WhatsApp Number
        </Button>
      </div>
      <ContactDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} contact={dialog.contact} onSaved={() => mutate()} />
    </div>
  );
}
