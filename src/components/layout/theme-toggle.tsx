"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { MoreMenu } from "@/components/ui/dropdown";
import { Segmented } from "@/components/ui/misc";

function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return m;
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const Icon = !mounted ? Sun : resolvedTheme === "dark" ? Moon : Sun;
  return (
    <MoreMenu
      label="Change theme"
      trigger={
        <button
          type="button"
          aria-label={`Theme: ${mounted ? theme : "system"}. Change theme`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-muted hover:text-fg"
        >
          <Icon className="size-[18px]" />
        </button>
      }
      items={[
        { label: "Light", icon: Sun, onSelect: () => setTheme("light") },
        { label: "Dark", icon: Moon, onSelect: () => setTheme("dark") },
        { label: "System", icon: Monitor, onSelect: () => setTheme("system") },
      ]}
    />
  );
}

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <Segmented
      label="Theme"
      value={(mounted ? theme : "system") as "light" | "dark" | "system"}
      onChange={(v) => setTheme(v)}
      options={[
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "System", icon: Monitor },
      ]}
    />
  );
}
