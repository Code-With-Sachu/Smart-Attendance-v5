"use client";
import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard, FormError } from "@/components/layout/auth-form";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/client/api";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot-password", { body: { email: new FormData(e.currentTarget).get("email") } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="flex gap-3 rounded-lg bg-success-soft p-4 text-sm text-fg">
          <MailCheck className="size-5 shrink-0 text-success" aria-hidden />
          If an account exists for that email, a reset link is on its way. It expires in 30 minutes.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" size="lg" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
