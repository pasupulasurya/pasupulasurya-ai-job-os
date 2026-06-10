"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, ShieldCheck, Loader2 } from "lucide-react";
import { spring } from "@/styles/tokens";
import { interviewTurnAction, closeGapAction } from "@/server/actions/tailor";
import type {
  TailoredJson,
  ChangeLedgerRecord,
  ConversationMessage,
} from "@/server/services/ai/tailor";

type ClosedSkill = { skill: string; bulletText: string; conversation: ConversationMessage[] };

type Props = {
  matchId: string;
  gapSkills: string[];
  closedSkills: ClosedSkill[];
  onGapClosed: (tailoredJson: TailoredJson, entry: ChangeLedgerRecord) => void;
};

export function GapPanel(props: Props) {
  if (props.gapSkills.length === 0 && props.closedSkills.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="mb-1 text-sm font-medium text-white">Skill gaps</h2>
      <p className="mb-5 text-xs leading-relaxed text-white/40">
        This job asks for skills your resume doesn&apos;t mention. If you genuinely have one, answer
        a couple of questions and it&apos;ll be added truthfully — verified, never invented. If you
        don&apos;t, leave it.
      </p>

      <div className="space-y-2">
        {props.gapSkills.map((skill) => (
          <GapThread
            key={skill}
            matchId={props.matchId}
            skill={skill}
            onGapClosed={props.onGapClosed}
          />
        ))}
        {props.closedSkills.map((c) => (
          <ClosedThread key={c.skill} closed={c} />
        ))}
      </div>
    </section>
  );
}

type ThreadState = "idle" | "interviewing" | "waiting" | "generating" | "refused";

function GapThread({
  matchId,
  skill,
  onGapClosed,
}: {
  matchId: string;
  skill: string;
  onGapClosed: Props["onGapClosed"];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ThreadState>("idle");
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const begin = () => {
    setOpen(true);
    if (state !== "idle") return;
    setState("waiting");
    startTransition(async () => {
      const res = await interviewTurnAction(matchId, skill, []);
      if ("error" in res) {
        setError(res.error);
        setState("idle");
        return;
      }
      if (res.turn.action === "ask" && res.turn.question) {
        setConversation([{ role: "ai", text: res.turn.question }]);
        setState("interviewing");
      }
    });
  };

  const send = () => {
    const text = input.trim();
    if (!text || state !== "interviewing") return;
    const next: ConversationMessage[] = [...conversation, { role: "user", text }];
    setConversation(next);
    setInput("");
    setState("waiting");
    setError(null);

    startTransition(async () => {
      const res = await interviewTurnAction(matchId, skill, next);
      if ("error" in res) {
        setError(res.error);
        setState("interviewing");
        return;
      }

      if (res.turn.action === "ask" && res.turn.question) {
        setConversation([...next, { role: "ai", text: res.turn.question }]);
        setState("interviewing");
        return;
      }
      if (res.turn.action === "refuse") {
        setState("refused");
        return;
      }
      // generate
      setState("generating");
      const closed = await closeGapAction(matchId, skill, next);
      if ("error" in closed) {
        setError(closed.error);
        setState("interviewing");
        return;
      }
      onGapClosed(closed.result.tailoredJson, closed.result.newLedgerEntry);
    });
  };

  return (
    <div className="rounded-xl border border-white/10">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : begin())}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm text-white/80">{skill}</span>
        <span className="flex items-center gap-2 text-xs text-white/40">
          Have you used this?
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={"transition-transform " + (open ? "rotate-180" : "")}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/5 px-4 py-4">
              {conversation.map((m, i) => (
                <p
                  key={i}
                  className={
                    "text-sm leading-relaxed " +
                    (m.role === "ai" ? "text-white/50" : "text-white/90")
                  }
                >
                  {m.text}
                </p>
              ))}

              {state === "refused" && (
                <p className="text-sm text-white/40">
                  No problem — this one stays off your resume. Honesty is the point.
                </p>
              )}

              {(state === "waiting" || state === "generating") && (
                <p className="flex items-center gap-2 text-xs text-white/40">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  {state === "generating"
                    ? "Writing your bullet — verifying every claim…"
                    : "Thinking…"}
                </p>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              {state === "interviewing" && (
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Your answer…"
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#0A84FF] focus:outline-none"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim()}
                    aria-label="Send"
                    className="rounded-lg bg-[#0A84FF] p-2 text-white transition-colors hover:bg-[#0A84FF]/90 disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClosedThread({ closed }: { closed: ClosedSkill }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#30D158]/20 bg-[#30D158]/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm text-white/80">
          <ShieldCheck className="h-4 w-4 text-[#30D158]" strokeWidth={1.5} />
          {closed.skill}
        </span>
        <span className="flex items-center gap-2 text-xs text-white/40">
          Added · verified
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={"transition-transform " + (open ? "rotate-180" : "")}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-white/5 px-4 py-4 text-xs">
              {closed.conversation.map((m, i) => (
                <p key={i} className={m.role === "ai" ? "text-white/40" : "text-white/70"}>
                  <span className="text-white/30">{m.role === "ai" ? "Asked: " : "You: "}</span>
                  {m.text}
                </p>
              ))}
              <p className="pt-1 leading-relaxed text-white/80">{closed.bulletText}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
