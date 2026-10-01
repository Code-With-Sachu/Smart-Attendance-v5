"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { displayRoll, rollWidth } from "@/lib/roll";
import { SearchInput } from "@/components/ui/misc";
import { cn, percent } from "@/lib/utils";

export type StatusRecord = { id: string; rollNumber: string; name: string; status: "present" | "absent" };

export function SummaryStats({ total, present, absent }: { total: number; present: number; absent: number }) {
  const items = [
    { label: "Total", value: total },
    { label: "Present", value: present },
    { label: "Absent", value: absent, absent: true },
    { label: "Attendance", value: `${percent(present, total)}%` },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div
          key={i.label}
          className={cn("rounded-xl border p-3 sm:p-4", i.absent ? "border-absent-border/50 bg-absent-bg" : "border-border bg-card")}
        >
          <dt className={cn("text-xs", i.absent ? "text-absent" : "text-fg-muted")}>{i.label}</dt>
          <dd className={cn("tabular mt-0.5 text-2xl font-semibold", i.absent ? "text-absent" : "text-fg")}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Absent and present lists with roll numbers + names, searchable. */
export function StatusLists({ records }: { records: StatusRecord[] }) {
  const [q, setQ] = React.useState("");
  const w = rollWidth(records.map((r) => r.rollNumber));
  const needle = q.trim().toLowerCase();
  const rollNeedle = needle.replace(/^0+(?=\d)/, "");
  const match = (r: StatusRecord) => !needle || r.name.toLowerCase().includes(needle) || r.rollNumber.toLowerCase().startsWith(rollNeedle);
  const absent = records.filter((r) => r.status === "absent");
  const present = records.filter((r) => r.status === "present");

  const List = ({ title, list, tone }: { title: string; list: StatusRecord[]; tone: "absent" | "present" }) => {
    const shown = list.filter(match);
    return (
      <section aria-label={`${title} students`} className="rounded-2xl border border-border bg-card">
        <h3
          className={cn(
            "flex items-center gap-2 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider",
            tone === "absent" ? "text-absent" : "text-success",
          )}
        >
          {tone === "absent" ? <X className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {title} — {list.length}
        </h3>
        {shown.length ? (
          <ul className={cn("divide-y divide-border text-sm", tone === "present" && "max-h-[420px] overflow-y-auto")}>
            {shown.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-4 py-2">
                <span className="tabular w-12 shrink-0 font-mono text-[13px] font-semibold text-fg">{displayRoll(r.rollNumber, w)}</span>
                <span className="min-w-0 truncate text-fg">{r.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-fg-muted">
            {list.length ? "No matches." : tone === "absent" ? "No absentees — full attendance." : "No students present."}
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="grid gap-4">
      <SearchInput value={q} onChange={setQ} placeholder="Filter by name or roll number" className="max-w-sm" />
      <div className="grid gap-4 lg:grid-cols-2">
        <List title="Absent" list={absent} tone="absent" />
        <List title="Present" list={present} tone="present" />
      </div>
    </div>
  );
}
