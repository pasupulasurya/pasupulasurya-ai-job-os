// AI Job OS content script — greenhouse.io job pages only.
// 2H.1: marker-gated payload fetch via the worker. Fills land in 2H.2.
const MARKER = "#aijos-apply=";

function getMatchId(): string | null {
  const h = window.location.hash;
  return h.startsWith(MARKER) ? h.slice(MARKER.length) : null;
}

async function main(): Promise<void> {
  const matchId = getMatchId();
  if (!matchId) return; // unmarked page: stay asleep

  console.log("[aijos] apply marker detected, matchId:", matchId);
  const reply = (await chrome.runtime.sendMessage({
    kind: "aijos.getPayload",
    matchId,
  })) as
    | {
        ok: true;
        payload: { identity: unknown; decisions: unknown[]; education: unknown; pdfUrl: string };
      }
    | { ok: false; status: number; error?: string };

  if (!reply.ok) {
    console.log(
      `[aijos] payload fetch failed (status ${reply.status})` +
        (reply.status === 401 ? " — log in to AI Job OS first" : ""),
      reply,
    );
    return;
  }
  console.log("[aijos] payload received:", {
    identity: reply.payload.identity,
    decisionCount: reply.payload.decisions.length,
    education: reply.payload.education,
    pdfUrl: reply.payload.pdfUrl,
  });
}

void main();
export {};
