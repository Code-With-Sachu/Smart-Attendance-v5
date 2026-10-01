"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  size = "md",
  hideClose,
  onInteractOutside,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  hideClose?: boolean;
  onInteractOutside?: (e: Event) => void;
}) {
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <D.Portal>
      <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" />
      <D.Content
        onInteractOutside={onInteractOutside}
        className={cn(
          "animate-pop-in fixed left-1/2 top-1/2 z-50 flex max-h-[min(92dvh,900px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-2xl border border-border bg-card shadow-modal focus:outline-none",
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold text-fg">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-fg-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
            )}
          </div>
          {!hideClose && (
            <D.Close className="-mr-2 -mt-1 rounded-md p-1.5 text-fg-muted hover:bg-muted hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row sm:justify-end sm:px-6",
        className,
      )}
      {...props}
    />
  );
}
