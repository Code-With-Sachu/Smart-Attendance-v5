"use client";
import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui/confirm";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ className: "!rounded-xl !text-sm" }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // next-themes injects a blocking script, so the correct theme is applied before first paint.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="sa-theme">
      <ConfirmProvider>
        {children}
        <ThemedToaster />
      </ConfirmProvider>
    </ThemeProvider>
  );
}
