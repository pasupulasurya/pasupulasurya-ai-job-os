"use client";

import { useState, useTransition } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { AuthBanner } from "@/components/auth/auth-banner";
import { signupSchema, magicLinkSchema } from "@/shared/schemas/auth";
import { signUpAction, magicLinkAction } from "@/server/actions/auth";

type Mode = "password" | "magic-link";
type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "magic-sent"; email: string }
  | { kind: "confirm-sent"; email: string };

export default function SignupPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldError, setFieldError] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [, startTransition] = useTransition();

  function handlePasswordSubmit(formData: FormData) {
    setFieldError({});
    const result = signupSchema.safeParse({
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
      const res = await signUpAction(formData);
      if ("error" in res) {
        setStatus({ kind: "error", message: res.error });
      } else {
        setStatus({
          kind: "confirm-sent",
          email: result.data.email,
        });
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

  // Success states
  if (status.kind === "confirm-sent") {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${status.email}. Click it to finish setting up your account.`}
      >
        <AuthBanner
          variant="success"
          title="Email sent"
          message="The link expires in 1 hour. Check your spam folder if you don't see it."
        />
      </AuthShell>
    );
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
      title="Create your account"
      subtitle="Start hunting deliberately."
      footer={{
        text: "Already have an account?",
        linkText: "Sign in",
        href: "/login",
      }}
    >
      <div className="space-y-4">
        {/* Mode toggle */}
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
          <AuthBanner variant="error" title="Couldn't sign you up" message={status.message} />
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
              autoComplete="new-password"
              required
              error={fieldError.password}
            />
            <p className="text-text-tertiary text-xs leading-relaxed">
              Must be 8+ characters with an uppercase letter, lowercase letter, and a number.
            </p>
            <SubmitButton>Create account</SubmitButton>
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
              No password needed. We&apos;ll send a one-click sign-in link to your inbox.
            </p>
            <SubmitButton>Send magic link</SubmitButton>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
