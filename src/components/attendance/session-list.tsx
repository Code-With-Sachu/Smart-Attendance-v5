"use client";
import * as React from "react";
import Link from "next/link";
import { Eye, MessageCircle, Pencil } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { WhatsAppShareDialog } from "@/components/whatsapp/whatsapp-share-dialog";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { Session, SessionRecord } from "@/lib/client/types";
import type { ReportInput } from "@/lib/report";
import { formatDateLong, formatTime12, percent } from "@/lib/utils";
import { toast } from "sonner";

export function useShareSession() {
  const [report, setReport] = React.useState<ReportInput | null>(null);
  const [open, setOpen] = React.useState(false);
  const share = async (s: Session) => {
    try {
      const d = await apiFetch<{ session: Session; records: SessionRecord[] }>(`/api/attendance/${s.id}`);
      setReport({
        date: d.session.date,
        time: d.session.time,
        mainModuleName: d.session.mainModuleName,
        subModuleName: d.session.subModuleName,
        sessionLabel: d.session.sessionLabel,
        records: d.records.map((r) => ({ rollNumber: r.rollNumber, name: r.name, status: r.status })),
      });
      setOpen(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const dialog = <WhatsAppShareDialog open={open} onOpenChange={setOpen} report={report} />;
  return { share, dialog };
}

export function SessionList({ sessions, showModule = true }: { sessions: Session[]; showModule?: boolean }) {
  const { share, dialog } = useShareSession();
  return (
    <>
      <ul className="divide-y divide-border">
        {sessions.map((s) => {
          const rate = percent(s.present, s.total);
          return (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <Link href={`/history/${s.id}`} className="font-medium text-fg hover:text-primary">
                  {formatDateLong(s.date)}
                </Link>
                <div className="mt-0.5 truncate text-[13px] text-fg-muted">
                  {showModule && (
                    <>
                      {s.mainModuleName} · {s.subModuleName} ·{" "}
                    </>
                  )}
                  {formatTime12(s.time)}
                  {s.sessionLabel !== "Session 1" && ` · ${s.sessionLabel}`}
                  {s.editCount > 0 && " · edited"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge>{s.total} students</Badge>
                <Badge tone="success">{s.present} present</Badge>
                <Badge tone="absent">{s.absent} absent</Badge>
                <Badge tone={rate < 75 ? "warning" : "primary"}>{rate}%</Badge>
              </div>
              <div className="flex gap-2">
                <LinkButton href={`/history/${s.id}`} variant="secondary" size="sm">
                  <Eye /> View details
                </LinkButton>
                <Button variant="ghost" size="sm" onClick={() => share(s)}>
                  <MessageCircle /> Share
                </Button>
                <LinkButton href={`/history/${s.id}?edit=1`} variant="ghost" size="icon-sm" aria-label={`Edit attendance for ${formatDateLong(s.date)}`}>
                  <Pencil />
                </LinkButton>
              </div>
            </li>
          );
        })}
      </ul>
      {dialog}
    </>
  );
}
