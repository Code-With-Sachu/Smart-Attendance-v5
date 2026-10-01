import { ClipboardCheck, FileSpreadsheet, History, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/misc";
import { LogoMark } from "@/components/layout/logo";

const STEPS = [
  { icon: FileSpreadsheet, title: "Upload the class list", text: "CSV, Excel, Google Sheets — PDF and Word lists too, with a review step." },
  { icon: ClipboardCheck, title: "Tap the absentees", text: "Everyone starts present. Apply, review names and roll numbers, then submit." },
  { icon: History, title: "Keep a reliable history", text: "Each record keeps the names and roll numbers from that day, even if the list changes later." },
  { icon: MessageCircle, title: "Share on WhatsApp", text: "Send a formatted report to saved contacts — WhatsApp opens with the message ready." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About" />
      <div className="grid gap-5">
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <LogoMark className="size-12" />
          <div>
            <h2 className="text-lg font-semibold text-fg">Smart Attendance</h2>
            <p className="text-sm text-fg-muted">
              A teacher attendance workspace that turns your student spreadsheet into a ready-to-use register.
            </p>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-medium text-fg-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold text-fg">{s.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{s.text}</p>
            </Card>
          ))}
        </div>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold text-fg">
            <ShieldCheck className="size-4 text-success" aria-hidden /> Privacy
          </h3>
          <ul className="mt-2 grid gap-1.5 text-sm text-fg-muted">
            <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Student data is visible only to your teacher account.</li>
            <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Uploaded files are read in memory and not stored — only the confirmed student list is saved.</li>
            <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Student data isn&apos;t sent to third-party services. WhatsApp only receives what you choose to send.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
