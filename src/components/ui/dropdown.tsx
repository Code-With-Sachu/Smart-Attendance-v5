"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuItem =
  | { type?: "item"; label: string; icon?: React.ElementType; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { type: "separator" };

/** A "⋮ More" menu. */
export function MoreMenu({
  items,
  label = "More actions",
  trigger,
  align = "end",
}: {
  items: MenuItem[];
  label?: string;
  trigger?: React.ReactNode;
  align?: "start" | "end";
}) {
  return (
    <M.Root>
      <M.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label}
            className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-muted hover:text-fg data-[state=open]:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      </M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="animate-fade-in z-50 min-w-48 rounded-xl border border-border bg-card p-1 shadow-pop"
        >
          {items.map((it, i) =>
            it.type === "separator" ? (
              <M.Separator key={i} className="my-1 h-px bg-border" />
            ) : (
              <M.Item
                key={i}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none",
                  "data-[highlighted]:bg-muted data-[disabled]:opacity-50",
                  it.danger ? "text-danger" : "text-fg",
                )}
              >
                {it.icon && <it.icon className="size-4 opacity-70" aria-hidden />}
                {it.label}
              </M.Item>
            ),
          )}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export const DropdownRoot = M.Root;
export const DropdownTrigger = M.Trigger;
export const DropdownPortal = M.Portal;
export const DropdownContent = M.Content;
export const DropdownItem = M.Item;
export const DropdownSeparator = M.Separator;
