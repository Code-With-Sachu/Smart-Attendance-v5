"use client";
import * as React from "react";
import { Card } from "@/components/ui/misc";

export function AuthCard({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="w-full max-w-[400px]">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mt-5 text-center text-sm text-fg-muted">{footer}</div>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}
