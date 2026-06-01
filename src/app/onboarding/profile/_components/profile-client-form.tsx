"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthBanner } from "@/components/auth/auth-banner";
import { profileSchema } from "@/shared/schemas/profile";
import { saveProfileAction } from "@/server/actions/profile";
import { spring } from "@/styles/tokens";

type Props = {
  initialValues: {
    firstName: string;
    lastName: string;
    phone: string;
  };
};

export function ProfileClientForm({ initialValues }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [phone, setPhone] = useState(initialValues.phone);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input = { firstName, lastName, phone };
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your inputs");
      return;
    }

    startTransition(async () => {
      const res = await saveProfileAction(input);
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      router.push("/onboarding/resume");
    });
  }

  return (
    <AuthShell
      title="Tell us about yourself"
      subtitle="A few basics so we can personalize your experience."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <AuthBanner variant="error" title="Couldn't save" message={error} />}

        <div className="space-y-2">
          <label
            htmlFor="firstName"
            className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
          >
            First name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            autoComplete="given-name"
            className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-3 py-2 text-sm transition-all outline-none focus-within:ring-2"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lastName"
            className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
          >
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
            autoComplete="family-name"
            className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-3 py-2 text-sm transition-all outline-none focus-within:ring-2"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="phone"
            className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
          >
            Phone (optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="2025551234 or +12025551234"
            autoComplete="tel"
            className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-3 py-2 text-sm transition-all outline-none focus-within:ring-2"
          />
          <p className="text-text-tertiary text-xs">
            Used for notifications later. We default to US if no country code.
          </p>
        </div>

        <motion.button
          type="submit"
          disabled={isPending}
          whileTap={{ scale: isPending ? 1 : 0.98 }}
          transition={spring.snappy}
          className="bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-pressed flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Saving…" : "Save and continue"}
        </motion.button>
      </form>
    </AuthShell>
  );
}
