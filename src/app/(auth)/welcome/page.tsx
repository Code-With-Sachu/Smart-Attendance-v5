"use client";
import Link from "next/link";
import { ArrowRight, Check, FileSpreadsheet, MessageCircle, MousePointerClick, ShieldCheck } from "lucide-react";
import { ThemeSegmented } from "@/components/layout/theme-toggle";
import { buttonClass } from "@/components/ui/button";

const FEATURES = [
  { icon: FileSpreadsheet, title: "Import student data", text: "Upload your class spreadsheet or link a Google Sheet. Roll numbers and names are detected for you." },
  { icon: MousePointerClick, title: "Mark attendance quickly", text: "Everyone starts present — tap only the students who are absent." },
  { icon: Check, title: "Review before you submit", text: "See present and absent lists with names and roll numbers, then confirm." },
  { icon: MessageCircle, title: "Share through WhatsApp", text: "Send a clean report to your saved contacts in a couple of taps." },
];

function markOnboarded() {
  document.cookie = "sa_onboarded=1; path=/; max-age=31536000; samesite=lax";
}

export default function WelcomePage() {
  return (
    <div className="w-full max-w-5xl">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-fg-muted">
            <ShieldCheck className="size-3.5 text-success" aria-hidden /> Private to your teacher account
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">Smart Attendance</h1>
          <p className="mt-4 max-w-lg text-lg text-fg-muted">
            A fast and intelligent attendance workspace for teachers. Turn your class spreadsheet into a ready-to-use register
            in under a minute.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" onClick={markOnboarded} className={buttonClass("primary", "lg")}>
              Get Started <ArrowRight />
            </Link>
            <Link href="/login" onClick={markOnboarded} className={buttonClass("secondary", "lg")}>
              I already have an account
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
            <span>Appearance</span>
            <ThemeSegmented />
          </div>
        </div>

        <ul className="grid gap-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                  <Check className="size-4 text-success" aria-hidden /> {f.title}
                </div>
                <p className="mt-0.5 text-sm text-fg-muted">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
