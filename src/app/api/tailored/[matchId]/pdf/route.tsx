// GET /api/tailored/[matchId]/pdf — ATS-safe PDF of the tailored resume.
// Auth: same Supabase->appUser pattern as server actions. Ownership enforced.
// Personal info: User row first, master parsedJson fallback per-field.
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import {
  ResumeDocument,
  pdfSafe,
  assembleResumePdfData,
  type ResumePdfData,
  type ParsedPersonal,
} from "@/server/pdf/resume-document";
import type { TailoredJson } from "@/server/services/ai/tailor";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return new NextResponse("Not authenticated", { status: 401 });

  const appUser = await prisma.user.findUnique({ where: { authId: authUser.id } });
  if (!appUser) return new NextResponse("Account not found", { status: 401 });

  const row = await prisma.tailoredResume.findUnique({
    where: { matchId },
    include: { master: { select: { parsedJson: true } } },
  });
  if (!row || row.userId !== appUser.id) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!["generated", "verified", "saved"].includes(row.status)) {
    return new NextResponse("Resume not ready", { status: 409 });
  }

  const tailored = row.tailoredJson as TailoredJson;
  const parsed = (row.master.parsedJson ?? {}) as ParsedPersonal;

  const data: ResumePdfData = assembleResumePdfData({
    user: appUser,
    parsed,
    tailored,
  });

  try {
    // Normalize typographic chars Helvetica can't shape (single choke point).
    const safeData = JSON.parse(
      JSON.stringify(data, (_k, v) => (typeof v === "string" ? pdfSafe(v) : v)),
    ) as ResumePdfData;
    const buffer = await renderToBuffer(<ResumeDocument data={safeData} />);
    const safeName = (data.name || "resume").replace(/[^a-zA-Z0-9]+/g, "-");
    logger.info({ matchId, userId: appUser.id }, "tailor.pdf_rendered");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-tailored.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ matchId, err: (err as Error).message }, "tailor.pdf_render_failed");
    return new NextResponse("PDF render failed", { status: 500 });
  }
}
