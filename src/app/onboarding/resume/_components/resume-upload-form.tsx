"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, ChevronLeft, X, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { AuthBanner } from "@/components/auth/auth-banner";
import { uploadMasterResumeAction } from "@/server/actions/resume";
import { spring } from "@/styles/tokens";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "success"; fileName: string }
  | { kind: "error"; message: string };

export function ResumeUploadForm({ existingFileName }: { existingFileName: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_BYTES) return "File too large (max 5 MB)";
    if (!ALLOWED_TYPES.has(file.type)) {
      return "Unsupported file type. PDF or DOCX only.";
    }
    return null;
  }

  function handleFile(file: File) {
    const error = validateFile(file);
    if (error) {
      setState({ kind: "error", message: error });
      return;
    }

    setState({ kind: "uploading", fileName: file.name });

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const res = await uploadMasterResumeAction(formData);
      if ("error" in res) {
        setState({ kind: "error", message: res.error });
        return;
      }
      setState({ kind: "success", fileName: file.name });
    });
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setState({ kind: "idle" });
  }

  return (
    <AuthShell
      title="Upload your resume"
      subtitle="We'll parse it to suggest skills and match jobs."
      header={<OnboardingProgress current={3} total={4} />}
    >
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {state.kind === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.snappy}
            >
              {existingFileName && (
                <p className="text-text-tertiary mb-3 text-xs">
                  Currently on file: <span className="text-text-secondary">{existingFileName}</span>
                  . Upload to replace.
                </p>
              )}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                  isDragging
                    ? "border-accent bg-accent/5"
                    : "border-border bg-card hover:border-border-strong"
                }`}
              >
                <div className="bg-surface flex h-12 w-12 items-center justify-center rounded-full">
                  <Upload size={20} strokeWidth={1.5} className="text-text-secondary" />
                </div>
                <p className="text-text-primary text-sm font-medium">
                  {isDragging ? "Release to upload" : "Drop your resume here"}
                </p>
                <p className="text-text-tertiary text-xs">
                  or click to browse · PDF or DOCX, max 5 MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            </motion.div>
          )}

          {state.kind === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.snappy}
              className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border p-12 text-center"
            >
              <Loader2 className="text-accent h-6 w-6 animate-spin" />
              <p className="text-text-primary text-sm font-medium">Parsing your resume…</p>
              <p className="text-text-tertiary text-xs">{state.fileName}</p>
            </motion.div>
          )}

          {state.kind === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.snappy}
              className="border-accent/30 bg-accent/5 flex flex-col items-center justify-center gap-3 rounded-xl border p-10 text-center"
            >
              <CheckCircle2 className="text-accent h-8 w-8" strokeWidth={1.5} />
              <p className="text-text-primary text-sm font-medium">Resume saved</p>
              <p className="text-text-tertiary flex items-center gap-1 text-xs">
                <FileText size={12} strokeWidth={1.5} />
                {state.fileName}
              </p>
            </motion.div>
          )}

          {state.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.snappy}
            >
              <AuthBanner variant="error" title="Couldn't upload" message={state.message} />
              <button
                type="button"
                onClick={reset}
                className="text-text-tertiary hover:text-text-secondary mt-3 inline-flex items-center gap-1 text-xs"
              >
                <X size={12} strokeWidth={1.5} />
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {state.kind === "success" && (
          <button
            type="button"
            onClick={() => router.push("/onboarding/preferences")}
            className="bg-accent hover:bg-accent-hover block w-full rounded-md px-6 py-3 text-center text-sm font-medium text-white transition-colors"
          >
            Continue
          </button>
        )}

        <Link
          href="/onboarding/profile"
          className="text-text-tertiary hover:text-text-secondary flex items-center justify-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft size={12} strokeWidth={1.5} />
          Back to profile
        </Link>
      </div>
    </AuthShell>
  );
}
