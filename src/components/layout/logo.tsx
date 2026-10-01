import { cn } from "@/lib/utils";

/** Original mark: a 3×3 roll grid with one "absent" cell and a check. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <g fill="var(--primary-fg)">
        <rect x="7" y="7" width="5" height="5" rx="1.5" opacity=".95" />
        <rect x="13.5" y="7" width="5" height="5" rx="1.5" opacity=".95" />
        <rect x="20" y="7" width="5" height="5" rx="1.5" opacity=".95" />
        <rect x="7" y="13.5" width="5" height="5" rx="1.5" opacity=".95" />
        <rect x="13.5" y="13.5" width="5" height="5" rx="1.5" opacity=".35" />
        <rect x="20" y="13.5" width="5" height="5" rx="1.5" opacity=".95" />
        <rect x="7" y="20" width="5" height="5" rx="1.5" opacity=".95" />
      </g>
      <path d="M14.5 22.6l2.4 2.4 5.3-5.6" fill="none" stroke="var(--primary-fg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && <span className="text-[15px] font-semibold tracking-tight text-fg">Smart Attendance</span>}
    </span>
  );
}
