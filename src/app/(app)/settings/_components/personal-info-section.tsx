"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Pencil, X } from "lucide-react";
import { AuthBanner } from "@/components/auth/auth-banner";
import { CountryPicker } from "@/components/onboarding/country-picker";
import { DEFAULT_COUNTRY_CODE, findCountry } from "@/shared/data/countries";
import { profileSchema } from "@/shared/schemas/profile";
import { saveProfileAction } from "@/server/actions/profile";
import { spring } from "@/styles/tokens";

type Props = {
  initialValues: {
    firstName: string;
    lastName: string;
    phone: string;
    country: string | null;
  };
};

export function PersonalInfoSection({ initialValues }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saved, setSaved] = useState(initialValues);
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [phone, setPhone] = useState(initialValues.phone);
  const [country, setCountry] = useState(initialValues.country ?? DEFAULT_COUNTRY_CODE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setError(null);
    setFirstName(saved.firstName);
    setLastName(saved.lastName);
    setPhone(saved.phone);
    setCountry(saved.country ?? DEFAULT_COUNTRY_CODE);
    setMode("edit");
  }

  function cancelEdit() {
    setError(null);
    setMode("view");
  }

  function handleSave() {
    setError(null);
    const input = { firstName, lastName, phone, country };
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
      const normalizedPhone = parsed.data.phone ?? "";
      setSaved({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: normalizedPhone,
        country: parsed.data.country,
      });
      setMode("view");
    });
  }

  return (
    <section>
      <div className="bg-card border-border relative rounded-2xl border p-5">
        {mode === "view" && (
          <button
            type="button"
            onClick={startEdit}
            className="text-text-tertiary hover:text-text-secondary absolute top-4 right-4 inline-flex items-center gap-1 text-xs transition-colors"
          >
            <Pencil size={12} strokeWidth={1.5} />
            Edit
          </button>
        )}
        <AnimatePresence mode="wait">
          {mode === "view" ? (
            <motion.dl
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3 text-sm"
            >
              <div className="flex justify-between gap-4">
                <dt className="text-text-tertiary">Name</dt>
                <dd className="text-text-primary text-right">
                  {saved.firstName || saved.lastName ? (
                    `${saved.firstName} ${saved.lastName}`.trim()
                  ) : (
                    <span className="text-text-tertiary">Not set</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-tertiary">Country</dt>
                <dd className="text-text-primary text-right">
                  {saved.country ? (
                    <span>
                      {findCountry(saved.country)?.name ?? saved.country}
                      <span className="text-text-tertiary ml-2 text-xs tabular-nums">
                        {findCountry(saved.country)?.dial}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-tertiary">Not set</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-tertiary">Phone</dt>
                <dd className="text-text-primary text-right tabular-nums">
                  {saved.phone || <span className="text-text-tertiary">Not set</span>}
                </dd>
              </div>
            </motion.dl>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {error && <AuthBanner variant="error" title="Couldn't save" message={error} />}

              <div className="space-y-2">
                <label
                  htmlFor="settings-firstName"
                  className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
                >
                  First name
                </label>
                <input
                  id="settings-firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-3 py-2 text-sm transition-all outline-none focus-within:ring-2"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="settings-lastName"
                  className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
                >
                  Last name
                </label>
                <input
                  id="settings-lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-3 py-2 text-sm transition-all outline-none focus-within:ring-2"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="settings-phone"
                  className="text-text-secondary block text-xs font-medium tracking-wide uppercase"
                >
                  Phone
                </label>
                <div className="flex">
                  <CountryPicker value={country} onChange={setCountry} />
                  <input
                    id="settings-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="2025551234"
                    autoComplete="tel-national"
                    className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 text-text-primary placeholder:text-text-tertiary flex-1 rounded-r-md border px-3 py-2 text-sm transition-all outline-none focus-within:ring-2"
                  />
                </div>
                <p className="text-text-tertiary text-xs">
                  Leave phone blank to clear. Select country first, then enter the local number.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isPending}
                  className="text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-40"
                >
                  <X size={14} strokeWidth={1.5} />
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  whileTap={{ scale: isPending ? 1 : 0.98 }}
                  transition={spring.snappy}
                  className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isPending ? "Saving…" : "Save"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
