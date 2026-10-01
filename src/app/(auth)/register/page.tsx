"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, FormError } from "@/components/layout/auth-form";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage, ApiClientError } from "@/lib/client/api";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiFetch("/api/auth/register", {
        body: { name: f.get("name"), email: f.get("email"), password: f.get("password") },
      });
      document.cookie = "sa_onboarded=1; path=/; max-age=31536000; samesite=lax";
      router.replace("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "validation") {
        const issues = (err.data.issues as { path: string[]; message: string }[]) ?? [];
        const map: Record<string, string> = {};
        issues.forEach((i) => (map[i.path[0]] ??= i.message));
        setFieldErrors(map);
      } else setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Your modules, students and attendance stay private to this account."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <Field label="Full name" error={fieldErrors.name}>
          <Input name="name" autoComplete="name" required placeholder="e.g. Sachu Thomas" />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <Input name="email" type="email" autoComplete="email" required placeholder="you@school.edu" />
        </Field>
        <Field label="Password" error={fieldErrors.password} hint="At least 8 characters, with a letter and a number.">
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" loading={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
