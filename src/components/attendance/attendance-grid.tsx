"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayRoll, firstName } from "@/lib/roll";

export type GridStudent = { id: string; rollNumber: string; name: string };

/**
 * The core attendance surface. Everyone starts present; tapping toggles absent.
 * Status is conveyed by colour + icon + text + aria-pressed (never colour alone).
 * Arrow keys move between students; Space/Enter toggles.
 */
export const AttendanceGrid = React.memo(function AttendanceGrid({
  students,
  absent,
  onToggle,
  view,
  width,
}: {
  students: GridStudent[];
  absent: Set<string>;
  onToggle: (id: string) => void;
  view: "compact" | "detailed";
  width: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key) || !ref.current) return;
    const buttons = Array.from(ref.current.querySelectorAll<HTMLButtonElement>("button[data-student]"));
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    const cols = getComputedStyle(ref.current).gridTemplateColumns.split(" ").length || 1;
    const next =
      e.key === "ArrowRight" ? idx + 1
      : e.key === "ArrowLeft" ? idx - 1
      : e.key === "ArrowDown" ? idx + cols
      : e.key === "ArrowUp" ? idx - cols
      : e.key === "Home" ? 0
      : buttons.length - 1;
    if (next >= 0 && next < buttons.length) {
      e.preventDefault();
      buttons[next].focus();
    }
  }

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Students — press a student to toggle absent"
      onKeyDown={onKeyDown}
      className={cn(
        "grid gap-2 sm:gap-2.5",
        view === "compact"
          ? "grid-cols-4 min-[420px]:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
      )}
    >
      {students.map((s) => {
        const isAbsent = absent.has(s.id);
        const roll = displayRoll(s.rollNumber, width);
        return (
          <button
            key={s.id}
            type="button"
            data-student
            aria-pressed={isAbsent}
            aria-label={`${roll} ${s.name} — ${isAbsent ? "Absent" : "Present"}`}
            title={`${roll} — ${s.name} (${isAbsent ? "Absent" : "Present"})`}
            onClick={() => onToggle(s.id)}
            className={cn(
              "relative flex select-none flex-col rounded-xl border-2 text-left transition-[background-color,border-color,transform] duration-100 active:scale-[0.97]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              view === "compact" ? "min-h-[64px] items-center justify-center px-1 py-2 text-center" : "min-h-[72px] justify-between px-3 py-2.5",
              isAbsent
                ? "border-absent-border bg-absent-bg text-absent"
                : "border-present-border bg-present-bg text-present hover:border-border-strong",
            )}
          >
            <span className={cn("flex w-full items-center gap-1.5", view === "compact" ? "justify-center" : "justify-between")}>
              <span className={cn("tabular font-mono font-semibold", view === "compact" ? "text-lg" : "text-base")}>{roll}</span>
              {view === "detailed" &&
                (isAbsent ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-absent-border/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    <X className="size-3" aria-hidden /> Absent
                  </span>
                ) : (
                  <Check className="size-4 text-present-dot" aria-hidden />
                ))}
            </span>
            <span
              className={cn(
                "w-full truncate",
                view === "compact" ? "mt-0.5 text-[11px] opacity-80" : "mt-1 text-[13px] font-medium",
                isAbsent ? "" : "text-fg-muted",
                isAbsent && view === "compact" && "font-semibold",
              )}
            >
              {view === "compact" ? (isAbsent ? "Absent" : firstName(s.name)) : s.name}
            </span>
            {view === "compact" && isAbsent && (
              <X className="absolute right-1 top-1 size-3" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
});
