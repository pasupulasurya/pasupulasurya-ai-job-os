"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { ScoreRing } from "../../../_components/score-ring";
import { ProgressState } from "./progress-state";
import { ResumePane } from "./resume-pane";
import { GapPanel } from "./gap-panel";
import { tailorForMatchAction, saveTailoredResumeAction } from "@/server/actions/tailor";
import type { TailoredJson, ChangeLedgerRecord } from "@/server/services/ai/tailor";

export type MasterParsedView = {
  summary: string;
  skills: string[];
  workHistory: Array<{
    title: string | null;
    company: string | null;
    startDate: string | null;
    endDate: string | null;
    bullets: string[];
  }>;
};

type TailoredState = {
  tailoredJson: TailoredJson;
  changeLedger: ChangeLedgerRecord[];
  status: "generated" | "verified" | "saved";
};

type Props = {
  matchId: string;
  jobTitle: string;
  jobCompany: string;
  matchScore: number;
  gapSkills: string[];
  masterParsed: MasterParsedView;
  initialTailored: TailoredState | null;
};

type ViewState = "cta" | "generating" | "ready";

export function TailorView(props: Props) {
  const [tailored, setTailored] = useState<TailoredState | null>(props.initialTailored);
  const [view, setView] = useState<ViewState>(props.initialTailored ? "ready" : "cta");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(props.initialTailored?.status === "saved");
  const [mobileTab, setMobileTab] = useState<"master" | "tailored">("tailored");
  const [, startTransition] = useTransition();

  const handleGenerate = () => {
    setView("generating");
    setError(null);
    startTransition(async () => {
      const res = await tailorForMatchAction(props.matchId);
      if ("error" in res) {
        setError(res.error);
        setView("cta");
        return;
      }
      setTailored({
        tailoredJson: res.result.tailoredJson,
        changeLedger: res.result.changeLedger,
        status: res.result.status,
      });
      setView("ready");
    });
  };

  const handleGapClosed = (tailoredJson: TailoredJson, entry: ChangeLedgerRecord) => {
    setTailored((prev) =>
      prev ? { ...prev, tailoredJson, changeLedger: [...prev.changeLedger, entry] } : prev,
    );
    setSaved(false);
  };

  const handleSave = () => {
    if (!tailored) return;
    startTransition(async () => {
      const res = await saveTailoredResumeAction(
        props.matchId,
        tailored.tailoredJson,
        tailored.changeLedger,
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div>
      <header className="mb-8">
        <a
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to matches
        </a>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight md:text-2xl">{props.jobTitle}</h1>
            <p className="mt-1 text-sm text-white/60">{props.jobCompany}</p>
          </div>
          <ScoreRing score={props.matchScore} size={48} />
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {view === "cta" && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            Generate a version of your resume tailored to this job. Every change is verified against
            your master — nothing is ever invented.
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A84FF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A84FF]/90"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.5} /> Tailor my resume
          </button>
        </div>
      )}

      {view === "generating" && <ProgressState />}

      {view === "ready" && tailored && (
        <>
          {/* Mobile tab switcher */}
          <div className="mb-4 flex rounded-lg border border-white/10 p-1 md:hidden">
            {(["master", "tailored"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={
                  "flex-1 rounded-md px-3 py-1.5 text-sm capitalize transition-colors " +
                  (mobileTab === tab ? "bg-white/10 text-white" : "text-white/40")
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className={mobileTab === "master" ? "" : "hidden md:block"}>
              <ResumePane
                kind="master"
                summary={props.masterParsed.summary}
                skills={props.masterParsed.skills}
                workHistory={props.masterParsed.workHistory.map((r) => ({
                  ...r,
                  bullets: r.bullets.map((text) => ({ text, changed: false, ledger: null })),
                }))}
              />
            </div>
            <div className={mobileTab === "tailored" ? "" : "hidden md:block"}>
              <ResumePane
                kind="tailored"
                summary={tailored.tailoredJson.summary}
                skills={tailored.tailoredJson.skills}
                workHistory={tailored.tailoredJson.workHistory.map((role, roleIdx) => ({
                  title: role.title,
                  company: role.company,
                  startDate: role.startDate,
                  endDate: role.endDate,
                  bullets: role.bullets.map((b, bIdx) => {
                    const entry = tailored.changeLedger.find(
                      (l) =>
                        l.targetRoleIndex === roleIdx &&
                        l.targetBulletIndex === bIdx &&
                        !l.reverted,
                    );
                    return { text: b.text, changed: !!entry, ledger: entry ?? null };
                  }),
                }))}
                summaryLedger={
                  tailored.changeLedger.find((l) => l.move === "summary_rewrite" && !l.reverted) ??
                  null
                }
              />
            </div>
          </div>

          <GapPanel
            matchId={props.matchId}
            gapSkills={props.gapSkills.filter(
              (s) =>
                !tailored.changeLedger.some(
                  (l) => l.skillClosed?.toLowerCase() === s.toLowerCase() && !l.reverted,
                ),
            )}
            closedSkills={tailored.changeLedger
              .filter((l) => l.skillClosed && !l.reverted)
              .map((l) => ({
                skill: l.skillClosed as string,
                bulletText: l.afterText,
                conversation: l.conversation ?? [],
              }))}
            onGapClosed={handleGapClosed}
          />

          {/* Save bar */}
          <div className="sticky bottom-4 mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-black/80 px-5 py-3 backdrop-blur-md">
            <p className="text-xs text-white/40">{saved ? "Saved" : "Unsaved changes"}</p>
            <button
              onClick={handleSave}
              disabled={saved}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0A84FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A84FF]/90 disabled:opacity-40"
            >
              <Check className="h-4 w-4" strokeWidth={1.5} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
