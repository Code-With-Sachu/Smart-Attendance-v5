"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import {
  BookOpen,
  ClipboardCheck,
  FolderKanban,
  History,
  Home,
  Info,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  User as UserIcon,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { useUser } from "./user-context";
import { Avatar } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { OUTBOX_EVENT, outboxKey, readLocal, writeLocal, type OutboxItem } from "@/lib/client/storage";

const NAV = [
  { href: "/profile", label: "Profile", icon: UserIcon },
  { href: "/", label: "Home", icon: Home },
  { href: "/modules", label: "Modules", icon: FolderKanban },
  { href: "/students", label: "Students", icon: Users },
  { href: "/attendance", label: "Take Attendance", icon: ClipboardCheck },
  { href: "/history", label: "Attendance History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "About", icon: Info },
];

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/modules", label: "Modules", icon: FolderKanban },
  { href: "/attendance", label: "Attend", icon: ClipboardCheck, primary: true },
  { href: "/history", label: "History", icon: History },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-muted hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="size-[18px] shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
}

/** Submits attendance that was saved on this device while offline. */
function OutboxSync() {
  const { user } = useUser();
  const [pending, setPending] = React.useState(0);
  const syncing = React.useRef(false);

  const sync = React.useCallback(async () => {
    const key = outboxKey(user.id);
    const items = readLocal<OutboxItem[]>(key, []);
    setPending(items.length);
    if (!items.length || syncing.current || !navigator.onLine) return;
    syncing.current = true;
    const t = toast.loading(`Syncing ${items.length} saved attendance ${items.length === 1 ? "session" : "sessions"}…`);
    let remaining = [...items];
    for (const item of items) {
      try {
        await apiFetch("/api/attendance", { body: item.payload });
        remaining = remaining.filter((i) => i.clientId !== item.clientId);
        toast.success(`Synced: ${item.label}`);
      } catch (e) {
        if (e instanceof ApiClientError && e.isNetwork) break; // still offline — keep everything
        // A real conflict (e.g. already submitted elsewhere) — drop it and tell the teacher
        remaining = remaining.filter((i) => i.clientId !== item.clientId);
        toast.error(`${item.label}: ${(e as Error).message}`, { duration: 10000 });
      }
    }
    writeLocal(key, remaining);
    setPending(remaining.length);
    toast.dismiss(t);
    syncing.current = false;
  }, [user.id]);

  React.useEffect(() => {
    sync();
    const on = () => sync();
    window.addEventListener("online", on);
    window.addEventListener(OUTBOX_EVENT, on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener(OUTBOX_EVENT, on);
    };
  }, [sync]);

  if (!pending) return null;
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">
      <WifiOff className="size-3.5" aria-hidden />
      {pending} waiting to sync
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      className="relative hidden w-full max-w-md md:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search modules, students and attendance"
        placeholder="Search modules, students, records…"
        className="h-9 w-full rounded-lg border border-border bg-muted/60 pl-9 pr-14 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:bg-surface focus:outline-none focus:ring-3 focus:ring-primary/15"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
        Ctrl K
      </kbd>
    </form>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const signOut = useSignOut();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(readLocal("sa:sidebar-collapsed", false));
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      writeLocal("sa:sidebar-collapsed", !c);
      return !c;
    });
  };
  // The attendance grid is a focused full-height experience on mobile
  const focusMode = /^\/attendance\/[^/]+$/.test(pathname);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-border", collapsed ? "justify-center" : "px-4")}>
          <Link href="/" aria-label="Smart Attendance home">
            {collapsed ? <LogoMark /> : <Logo />}
          </Link>
        </div>
        <div className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
          <NavList collapsed={collapsed} />
        </div>
        <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
          <button
            onClick={toggle}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-fg-muted hover:bg-muted hover:text-fg",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button
            className="-ml-1 inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-muted lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" className="lg:hidden" aria-label="Smart Attendance home">
            <LogoMark className="size-7" />
          </Link>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <OutboxSync />
            <Link
              href="/search"
              className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-muted md:hidden"
              aria-label="Search"
            >
              <Search className="size-[18px]" />
            </Link>
            <ThemeToggle />
            <MoreMenu
              label="Account menu"
              trigger={
                <button className="ml-1 rounded-full ring-offset-2 ring-offset-bg focus-visible:ring-2" aria-label="Account menu">
                  <Avatar name={user.name} src={user.photo} size={32} />
                </button>
              }
              items={[
                { label: "Profile", icon: UserIcon, onSelect: () => router.push("/profile") },
                { label: "Settings", icon: Settings, onSelect: () => router.push("/settings") },
                { type: "separator" },
                { label: "Sign out", icon: LogOut, onSelect: signOut, danger: true },
              ]}
            />
          </div>
        </header>

        <main id="main" className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", !focusMode && "pb-28 lg:pb-8")}>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {!focusMode && (
        <nav
          aria-label="Quick navigation"
          className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
                    active ? "text-primary" : "text-fg-muted",
                  )}
                >
                  {item.primary ? (
                    <span className="-mt-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-pop">
                      <item.icon className="size-5" aria-hidden />
                    </span>
                  ) : (
                    <item.icon className="size-5" aria-hidden />
                  )}
                  {item.label}
                </Link>
              );
            })}
            <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-fg-muted">
              <BookOpen className="size-5" aria-hidden />
              More
            </button>
          </div>
        </nav>
      )}

      {/* Mobile drawer */}
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-slate-950/45 lg:hidden" />
          <D.Content className="animate-slide-in-left fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-surface lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation menu</D.Description>
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Logo />
              <D.Close className="rounded-md p-1.5 text-fg-muted hover:bg-muted" aria-label="Close navigation">
                <X className="size-4" />
              </D.Close>
            </div>
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <Avatar name={user.name} src={user.photo} size={40} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-fg">{user.name}</div>
                <div className="truncate text-xs text-fg-muted">{user.subject || user.email}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavList onNavigate={() => setDrawer(false)} />
            </div>
            <div className="border-t border-border p-3">
              <button onClick={signOut} className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-danger hover:bg-danger-soft">
                <LogOut className="size-[18px]" /> Sign out
              </button>
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}
