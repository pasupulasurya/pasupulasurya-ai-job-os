"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, Loader2, X } from "lucide-react";
import { requestResumeUploadUrlAction, uploadMasterResumeAction } from "@/server/actions/resume";
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

export function ResumeUploadCard() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Auto-reset success back to idle after a brief celebration, and refresh
  // the resume list so the newly uploaded master appears.
  useEffect(() => {
    if (state.kind !== "success") return;
    const t = setTimeout(() => {
      setState({ kind: "idle" });
      router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [state, router]);

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_BYTES) return "File too large (max 5 MB)";
    if (!ALLOWED_TYPES.has(file.type)) return "Unsupported file type. PDF or DOCX only.";
    return null;
  }

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) {
      setState({ kind: "error", message: err });
      return;
    }
    setState({ kind: "uploading", fileName: file.name });
    startTransition(async () => {
      const urlRes = await requestResumeUploadUrlAction(file.name, file.size, file.type);
      if ("error" in urlRes) {
        setState({ kind: "error", message: urlRes.error });
        return;
      }
      const putRes = await fetch(urlRes.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) {
        const detail = await putRes.text().catch(() => putRes.statusText);
        setState({
          kind: "error",
          message: "Upload failed: " + (detail.slice(0, 200) || putRes.statusText),
        });
        return;
      }
      const procRes = await uploadMasterResumeAction(urlRes.storagePath);
      if ("error" in procRes) {
        setState({ kind: "error", message: procRes.error });
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
    if (inputRef.current) inputRef.current.value = "";
  }
  function reset() {
    setState({ kind: "idle" });
  }

  return (
    <AnimatePresence mode="wait">
      {state.kind === "idle" && (
        <motion.div
          key="idle"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={spring.snappy}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={
            "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 transition-colors " +
            (isDragging
              ? "border-accent bg-accent/5"
              : "border-border bg-card hover:border-border-strong")
          }
        >
          <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Upload size={18} strokeWidth={1.5} className="text-text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-text-primary text-sm font-medium">
              {isDragging ? "Release to upload" : "Upload a new resume"}
            </p>
            <p className="text-text-tertiary mt-0.5 text-xs">
              Drag and drop or click to browse · PDF or DOCX, max 5 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            onChange={handleFileInput}
            className="hidden"
          />
        </motion.div>
      )}

      {state.kind === "uploading" && (
        <motion.div
          key="uploading"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.snappy}
          className="border-border bg-card flex items-center gap-4 rounded-2xl border p-5"
        >
          <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Loader2 className="text-accent h-4 w-4 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-text-primary text-sm font-medium">Parsing and matching jobs…</p>
            <p className="text-text-tertiary mt-0.5 truncate text-xs">{state.fileName}</p>
          </div>
        </motion.div>
      )}

      {state.kind === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.snappy}
          className="border-accent/30 bg-accent/5 flex items-center gap-4 rounded-2xl border p-5"
        >
          <div className="bg-accent/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <CheckCircle2 className="text-accent h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-text-primary text-sm font-medium">Resume saved as master</p>
            <p className="text-text-tertiary mt-0.5 truncate text-xs">{state.fileName}</p>
          </div>
        </motion.div>
      )}

      {state.kind === "error" && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.snappy}
          className="flex items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-300">Couldn&apos;t upload</p>
            <p className="text-text-tertiary mt-0.5 text-xs">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 text-xs transition-colors"
          >
            <X size={12} strokeWidth={1.5} />
            Try again
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
