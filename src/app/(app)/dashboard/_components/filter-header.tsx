"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type FilterHeaderProps = {
  companies: string[];
};

const SORTS = [
  { value: "score", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "company", label: "Company" },
];
const SCORES = [
  { value: "", label: "Any score" },
  { value: "50", label: "50+" },
  { value: "70", label: "70+" },
  { value: "85", label: "85+" },
];
const DATES = [
  { value: "", label: "Any time" },
  { value: "1", label: "Past 24h" },
  { value: "3", label: "Past 3 days" },
  { value: "7", label: "Past week" },
  { value: "30", label: "Past month" },
];
const REMOTE = [
  { value: "", label: "Anywhere" },
  { value: "true", label: "Remote" },
  { value: "false", label: "Onsite" },
];

const pillBase =
  "h-10 appearance-none rounded-[11px] border bg-gradient-to-b py-0 pl-3.5 pr-8 text-[13px] " +
  "shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_2px_rgba(0,0,0,0.2)] " +
  "outline-none transition-colors [&>option]:bg-[#1c1c1e] [&>option]:text-white";

export function FilterHeader({ companies }: FilterHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  const active = (key: string, fallback = "") => params.get(key) ?? fallback;
  const isOn = (key: string) => Boolean(params.get(key));
  const hasFilters = ["q", "minScore", "postedWithin", "remote", "company", "location"].some((k) =>
    params.get(k),
  );

  const pillTone = (on: boolean) =>
    pillBase +
    (on
      ? " border-[#0A84FF] from-[#0A84FF]/15 to-[#0A84FF]/5 text-[#0A84FF]"
      : " border-white/10 from-white/[0.08] to-white/[0.03] text-white/80 hover:border-white/25");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_-1px_0_rgba(0,0,0,0.3)_inset,0_4px_16px_rgba(0,0,0,0.25)]">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-[15px] size-4 -translate-y-1/2 text-white/35" />
        <input
          ref={searchRef}
          type="text"
          defaultValue={active("q")}
          placeholder="Search title or company"
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", e.currentTarget.value.trim());
          }}
          onBlur={(e) => setParam("q", e.currentTarget.value.trim())}
          className="h-10 w-full rounded-[11px] border border-white/[0.08] bg-gradient-to-b from-black/25 to-black/10 py-0 pr-3 pl-11 text-sm text-white shadow-[0_1px_1px_rgba(0,0,0,0.3)_inset] transition-colors outline-none placeholder:text-white/35 focus:border-[#0A84FF]"
        />
      </div>

      <select
        value={active("sort", "score")}
        onChange={(e) => setParam("sort", e.target.value === "score" ? "" : e.target.value)}
        className={pillTone(isOn("sort"))}
        aria-label="Sort by"
      >
        {SORTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={active("minScore")}
        onChange={(e) => setParam("minScore", e.target.value)}
        className={pillTone(isOn("minScore"))}
        aria-label="Minimum score"
      >
        {SCORES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={active("postedWithin")}
        onChange={(e) => setParam("postedWithin", e.target.value)}
        className={pillTone(isOn("postedWithin"))}
        aria-label="Date posted"
      >
        {DATES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={active("remote")}
        onChange={(e) => setParam("remote", e.target.value)}
        className={pillTone(isOn("remote"))}
        aria-label="Remote"
      >
        {REMOTE.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {companies.length > 0 && (
        <select
          value={active("company")}
          onChange={(e) => setParam("company", e.target.value)}
          className={pillTone(isOn("company"))}
          aria-label="Company"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="h-10 rounded-[11px] px-3.5 text-[13px] text-white/45 transition-colors hover:text-white/85"
        >
          Clear
        </button>
      )}
    </div>
  );
}
