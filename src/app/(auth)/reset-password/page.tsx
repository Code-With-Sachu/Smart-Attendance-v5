"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, FormError } from "@/components/layout/auth-form";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/client/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(token ? null : "This reset link is incomplete. Request a new one.");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError("Passwords don't match.");
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/reset-password", { body: { token, password: f.get("password") } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <Field label="New password" hint="At least 8 characters, with a letter and a number.">
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm password">
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" loading={loading} disabled={!token}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetForm />
    </React.Suspense>
  );
}
