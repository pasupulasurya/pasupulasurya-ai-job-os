"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, MessageSquare } from "lucide-react";
import { spring } from "@/styles/tokens";
import type { ChangeLedgerRecord } from "@/server/services/ai/tailor";

type PaneBullet = { text: string; changed: boolean; ledger: ChangeLedgerRecord | null };
type PaneRole = {
  title: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  bullets: PaneBullet[];
};

type Props = {
  kind: "master" | "tailored";
  summary: string;
  skills: string[];
  workHistory: PaneRole[];
  summaryLedger?: ChangeLedgerRecord | null;
};

export function ResumePane(props: Props) {
  const isMaster = props.kind === "master";
  return (
    <section
      className={
        "rounded-2xl border p-5 md:p-6 " +
        (isMaster ? "border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/[0.04]")
      }
    >
      <h2
        className={
          "mb-5 text-xs font-medium tracking-widest uppercase " +
          (isMaster ? "text-white/30" : "text-[#0A84FF]")
        }
      >
        {isMaster ? "Master" : "Tailored"}
      </h2>

      {/* Summary */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs tracking-wide text-white/30 uppercase">Summary</h3>
        {props.kind === "tailored" && props.summaryLedger ? (
          <ChangeableText text={props.summary} ledger={props.summaryLedger} />
        ) : (
          <p
            className={"text-sm leading-relaxed " + (isMaster ? "text-white/50" : "text-white/80")}
          >
            {props.summary || "—"}
          </p>
        )}
      </div>

      {/* Skills */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs tracking-wide text-white/30 uppercase">Skills</h3>
        <div className="flex flex-wrap gap-1.5">
          {props.skills.map((s) => (
            <span
              key={s}
              className={
                "rounded-full px-2.5 py-1 text-xs " +
                (isMaster ? "bg-white/5 text-white/40" : "bg-white/8 text-white/70")
              }
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Work history */}
      <div className="space-y-6">
        {props.workHistory.map((role, i) => (
          <div key={i}>
            <h3 className="text-sm font-medium text-white/90">{role.title ?? "—"}</h3>
            <p className="mb-2 text-xs text-white/40">
              {role.company ?? ""}
              {role.startDate && (
                <span>
                  {" "}
                  · {role.startDate} – {role.endDate ?? "Present"}
                </span>
              )}
            </p>
            <ul className="space-y-2">
              {role.bullets.map((b, j) => (
                <li key={j}>
                  {b.changed && b.ledger ? (
                    <ChangeableText text={b.text} ledger={b.ledger} />
                  ) : (
                    <p
                      className={
                        "text-sm leading-relaxed " + (isMaster ? "text-white/50" : "text-white/80")
                      }
                    >
                      {b.text}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * A changed piece of text: #0A84FF left-edge rule, clickable to reveal
 * what changed and why — before/after, the evidence conversation (for
 * gap-closed bullets), and the verification badge.
 */
function ChangeableText({ text, ledger }: { text: string; ledger: ChangeLedgerRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-l-2 border-[#0A84FF] pl-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-left text-sm leading-relaxed text-white transition-colors hover:text-[#0A84FF]"
      >
        {text}
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
            <div className="mt-3 space-y-3 rounded-lg bg-white/[0.03] p-3 text-xs">
              {ledger.beforeText && (
                <div>
                  <p className="mb-1 tracking-wide text-white/30 uppercase">Before</p>
                  <p className="leading-relaxed text-white/50">{ledger.beforeText}</p>
                </div>
              )}
              {ledger.skillClosed && (
                <div>
                  <p className="mb-1 tracking-wide text-white/30 uppercase">Closes gap</p>
                  <p className="text-white/70">{ledger.skillClosed}</p>
                </div>
              )}
              {ledger.conversation && ledger.conversation.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1 tracking-wide text-white/30 uppercase">
                    <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> Your evidence
                  </p>
                  <div className="space-y-1.5">
                    {ledger.conversation.map((m, i) => (
                      <p key={i} className={m.role === "ai" ? "text-white/40" : "text-white/70"}>
                        <span className="text-white/30">
                          {m.role === "ai" ? "Asked: " : "You: "}
                        </span>
                        {m.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <p className="flex items-center gap-1 text-[#30D158]">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                Verified against your master — nothing invented
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
