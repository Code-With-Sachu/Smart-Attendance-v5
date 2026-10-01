"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, MessageCircle, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/client/api";
import type { Contact } from "@/lib/client/types";
import { buildAttendanceReport, whatsappLink, type ReportInput } from "@/lib/report";
import { maskPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * WhatsApp sharing via official click-to-chat links (wa.me). WhatsApp opens
 * with the message pre-filled; the teacher presses Send. Automatic sending
 * would need the WhatsApp Business Platform with server-side credentials.
 */
export function WhatsAppShareDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  report: ReportInput | null;
}) {
  const { data, isLoading } = useApi<{ contacts: Contact[] }>(open ? "/api/contacts" : null);
  const contacts = data?.contacts ?? [];
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [opened, setOpened] = React.useState<Set<string>>(new Set());
  const [includePresent, setIncludePresent] = React.useState(true);
  const [includeNames, setIncludeNames] = React.useState(true);

  React.useEffect(() => {
    if (open && data) {
      setSelected(new Set(data.contacts.map((c) => c.id)));
      setOpened(new Set());
      setIncludePresent((report?.records.length ?? 0) <= 80);
    }
  }, [open, data, report]);

  const message = React.useMemo(
    () => (report ? buildAttendanceReport(report, { includePresent, includeNames }) : ""),
    [report, includePresent, includeNames],
  );
  const chosen = contacts.filter((c) => selected.has(c.id));
  const nextUp = chosen.find((c) => !opened.has(c.id));

  function openFor(c: Contact) {
    window.open(whatsappLink(message, c.phone), "_blank", "noopener,noreferrer");
    setOpened((o) => new Set(o).add(c.id));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.replace(/\*/g, ""));
      toast.success("Report copied");
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually.");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ text: message.replace(/\*/g, "") });
    } catch {
      /* cancelled */
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Share on WhatsApp" description="Choose recipients, check the message, then send it from WhatsApp." size="lg">
        <DialogBody className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
          <div className="grid content-start gap-4">
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-fg">Select recipients</h3>
              {isLoading ? (
                <Skeleton className="h-24" />
              ) : !contacts.length ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-fg-muted">
                  No saved WhatsApp contacts.{" "}
                  <Link href="/profile#whatsapp" className="font-medium text-primary hover:underline">
                    <UserPlus className="mr-1 inline size-3.5" aria-hidden />
                    Add contacts
                  </Link>{" "}
                  or share to any chat below.
                </div>
              ) : (
                <ul className="grid gap-1.5">
                  {contacts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onChange={(v) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (v) n.add(c.id);
                            else n.delete(c.id);
                            return n;
                          })
                        }
                        label={c.label || c.name}
                        description={`${c.label ? `${c.name} · ` : ""}${maskPhone(c.phone)}`}
                      />
                      {selected.has(c.id) && (
                        <Button
                          size="sm"
                          variant={opened.has(c.id) ? "ghost" : "secondary"}
                          onClick={() => openFor(c)}
                          aria-label={`Open WhatsApp chat with ${c.name}`}
                        >
                          {opened.has(c.id) ? <CheckCircle2 className="text-success" /> : <ExternalLink />}
                          {opened.has(c.id) ? "Opened" : "Open"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-2.5 rounded-xl bg-muted/60 p-3">
              <Checkbox checked={includeNames} onChange={setIncludeNames} label="Include student names" />
              <Checkbox
                checked={includePresent}
                onChange={setIncludePresent}
                label="Include present list"
                description="Long lists may be cut off by WhatsApp on some phones."
              />
            </div>
            <p className="text-xs text-fg-muted">
              WhatsApp opens one chat at a time with the report filled in — press Send in each chat. Messages are never sent
              automatically.
            </p>
          </div>
          <div className="grid content-start gap-2">
            <h3 className="text-[13px] font-semibold text-fg">Message preview</h3>
            <pre
              className="max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-[#e7f7e1] p-4 font-sans text-[13px] leading-relaxed text-slate-900 dark:bg-[#0f2a1d] dark:text-slate-100"
              aria-label="WhatsApp message preview"
            >
              {message}
            </pre>
          </div>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={copy}>
              <Copy /> Copy
            </Button>
            {canNativeShare && (
              <Button variant="ghost" onClick={nativeShare}>
                <Share2 /> More apps
              </Button>
            )}
            <Button variant="ghost" onClick={() => window.open(whatsappLink(message), "_blank", "noopener,noreferrer")}>
              <MessageCircle /> Pick chat in WhatsApp
            </Button>
          </div>
          <Button
            onClick={() => nextUp && openFor(nextUp)}
            disabled={!nextUp}
            className={cn("bg-[#25D366] text-[#08311a] hover:bg-[#1fbe5b] dark:text-[#08311a]")}
          >
            <MessageCircle />
            {!chosen.length
              ? "Select recipients"
              : nextUp
                ? `Share with ${nextUp.label || nextUp.name}${chosen.length > 1 ? ` (${chosen.indexOf(nextUp) + 1}/${chosen.length})` : ""}`
                : "All chats opened"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
