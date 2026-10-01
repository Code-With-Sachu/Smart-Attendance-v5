"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, FormError } from "@/components/layout/auth-form";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/client/api";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your attendance workspace."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required placeholder="you@school.edu" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-[13px] text-fg-muted hover:text-fg">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
