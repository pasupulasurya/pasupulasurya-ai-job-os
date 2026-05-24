"use client";

import { useState, useTransition } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { AuthBanner } from "@/components/auth/auth-banner";
import { loginSchema, magicLinkSchema } from "@/shared/schemas/auth";
import { loginAction, magicLinkAction } from "@/server/actions/auth";

type Mode = "password" | "magic-link";
type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "magic-sent"; email: string };

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldError, setFieldError] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [, startTransition] = useTransition();

  function handlePasswordSubmit(formData: FormData) {
    setFieldError({});
    const result = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      const errors: typeof fieldError = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as "email" | "password";
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldError(errors);
      return;
    }

    startTransition(async () => {
      const res = await loginAction(formData);
      // If loginAction returns, it means login failed (success redirects)
      if (res && "error" in res) {
        setStatus({ kind: "error", message: res.error });
      }
    });
  }

  function handleMagicLinkSubmit(formData: FormData) {
    setFieldError({});
    const result = magicLinkSchema.safeParse({
      email: formData.get("email"),
    });

    if (!result.success) {
      setFieldError({ email: result.error.issues[0]?.message });
      return;
    }

    startTransition(async () => {
      const res = await magicLinkAction(formData);
      if ("error" in res) {
        setStatus({ kind: "error", message: res.error });
      } else {
        setStatus({
          kind: "magic-sent",
          email: result.data.email,
        });
      }
    });
  }

  if (status.kind === "magic-sent") {
    return (
      <AuthShell title="Check your inbox" subtitle={`We sent a sign-in link to ${status.email}.`}>
        <AuthBanner
          variant="success"
          title="Magic link sent"
          message="Click the link in your email to sign in. It expires in 1 hour."
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue."
      footer={{
        text: "Don't have an account?",
        linkText: "Sign up",
        href: "/signup",
      }}
    >
      <div className="space-y-4">
        <div className="bg-card border-border flex rounded-md border p-1">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setStatus({ kind: "idle" });
            }}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "password"
                ? "bg-surface text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("magic-link");
              setStatus({ kind: "idle" });
            }}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "magic-link"
                ? "bg-surface text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Magic link
          </button>
        </div>

        {status.kind === "error" && (
          <AuthBanner variant="error" title="Couldn't sign you in" message={status.message} />
        )}

        {mode === "password" ? (
          <form action={handlePasswordSubmit} className="space-y-4">
            <FormField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              error={fieldError.email}
            />
            <FormField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              error={fieldError.password}
            />
            <SubmitButton>Sign in</SubmitButton>
          </form>
        ) : (
          <form action={handleMagicLinkSubmit} className="space-y-4">
            <FormField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              error={fieldError.email}
            />
            <p className="text-text-tertiary text-xs leading-relaxed">
              We&apos;ll email you a one-click sign-in link.
            </p>
            <SubmitButton>Send magic link</SubmitButton>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
