"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileSpreadsheet,
  MessageCircle,
  MousePointerClick,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ThemeSegmented } from "@/components/layout/theme-toggle";
import { buttonClass } from "@/components/ui/button";

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Import student data",
    text: "Upload CSV or Excel student files and organize your class list without manually entering every student.",
  },
  {
    icon: MousePointerClick,
    title: "Mark attendance quickly",
    text: "Start with the full class present and tap students to mark them absent in seconds.",
  },
  {
    icon: BarChart3,
    title: "Track attendance history",
    text: "Review previous attendance sessions, records, and class statistics from one organized workspace.",
  },
  {
    icon: MessageCircle,
    title: "Share attendance reports",
    text: "Prepare clean attendance reports and share them through WhatsApp when needed.",
  },
];

const HIGHLIGHTS = [
  "Student management",
  "Modules & sub-modules",
  "Attendance history",
  "Attendance analytics",
  "File import support",
  "WhatsApp sharing",
  "Dark & light mode",
];

export default function WelcomePage() {
  return (
    <main className="w-full max-w-6xl">
      <section className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        {/* Left Section */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-fg-muted shadow-card">
            <ShieldCheck
              className="size-3.5 text-success"
              aria-hidden
            />
            Simple · Organized · Fast
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-fg sm:text-5xl lg:text-6xl">
            Smart Attendance
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-fg-muted sm:text-xl">
            A modern attendance management workspace designed to make
            classroom attendance faster, simpler, and easier to organize.
          </p>

          <p className="mt-4 max-w-xl text-sm leading-6 text-fg-muted">
            Manage students, organize your classes, record attendance, review
            previous sessions, analyze attendance data, and keep your complete
            attendance workflow in one place.
          </p>

          {/* Go to Home */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className={buttonClass("primary", "lg")}
            >
              Go to Home
              <ArrowRight />
            </Link>
          </div>

          {/* Highlights */}
          <div className="mt-8 flex flex-wrap gap-2">
            {HIGHLIGHTS.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-fg-muted"
              >
                <Check
                  className="size-3.5 text-success"
                  aria-hidden
                />
                {item}
              </span>
            ))}
          </div>

          {/* Theme */}
          <div className="mt-8 flex items-center gap-3 text-sm text-fg-muted">
            <span>Appearance</span>
            <ThemeSegmented />
          </div>
        </div>

        {/* Right Section */}
        <div className="grid gap-4">
          {/* Main Feature Card */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Users
                className="size-5"
                aria-hidden
              />
            </div>

            <h2 className="mt-5 text-xl font-semibold text-fg">
              Everything for your classroom
            </h2>

            <p className="mt-2 text-sm leading-6 text-fg-muted">
              Keep your students, classes, attendance sessions, history, and
              reports organized from preparation to final submission.
            </p>
          </div>

          {/* Feature List */}
          <ul className="grid gap-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <li
                  key={feature.title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon
                      className="size-5"
                      aria-hidden
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                      <Check
                        className="size-4 text-success"
                        aria-hidden
                      />
                      {feature.title}
                    </div>

                    <p className="mt-1 text-sm leading-5 text-fg-muted">
                      {feature.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
