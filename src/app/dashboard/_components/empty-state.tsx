"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { triggerMatcherAction } from "@/server/actions/match";

const PHRASES = [
  "Scanning available jobs.",
  "Reading job descriptions for skills that match yours.",
  "Checking which roles sponsor your visa.",
  "Comparing seniority to your experience.",
  "Finding companies in your preferred locations.",
  "Almost there.",
];

const PHRASE_INTERVAL_MS = 2500;

type Phase = "scanning" | "no_results" | "error";

export function EmptyState() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Phrase rotation
  useEffect(() => {
    if (phase !== "scanning") return;
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  // Trigger matcher on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await triggerMatcherAction();
      if (cancelled) return;
      if ("error" in result) {
        setErrorMsg(result.error);
        setPhase("error");
        return;
      }
      if (result.matchCount > 0) {
        // Matches exist — refresh server data so the page re-renders with cards.
        startTransition(() => router.refresh());
      } else {
        setPhase("no_results");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-8 rounded-full bg-white/5 p-6"
      >
        <Search className="h-10 w-10 text-[#0A84FF]" strokeWidth={1.5} />
      </motion.div>

      {phase === "scanning" && (
        <>
          <h1 className="mb-3 text-2xl font-medium tracking-tight text-white">
            Finding your matches.
          </h1>
          <div className="h-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-sm text-white/60"
              >
                {PHRASES[phraseIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </>
      )}

      {phase === "no_results" && (
        <>
          <h1 className="mb-3 text-2xl font-medium tracking-tight text-white">
            No strong matches yet.
          </h1>
          <p className="max-w-md text-sm text-white/60">
            We&apos;ll keep looking. New jobs come in daily and we&apos;ll surface them as they
            arrive.
          </p>
        </>
      )}

      {phase === "error" && (
        <>
          <h1 className="mb-3 text-2xl font-medium tracking-tight text-white">
            Something went wrong.
          </h1>
          <p className="max-w-md text-sm text-white/60">{errorMsg ?? "Try refreshing the page."}</p>
        </>
      )}
    </div>
  );
}
