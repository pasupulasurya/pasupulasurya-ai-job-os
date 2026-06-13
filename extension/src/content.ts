// AI Job OS content script — greenhouse.io job pages only.
// Marker-gated: fetch payload via worker, execute fills. NEVER submits.
import { executeFills, type Payload } from "./fill";

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
  })) as { ok: true; payload: Payload } | { ok: false; status: number; error?: string };

  if (!reply.ok) {
    console.log(
      `[aijos] payload fetch failed (status ${reply.status})` +
        (reply.status === 401 ? " — log in to AI Job OS first" : ""),
      reply,
    );
    return;
  }
  console.log("[aijos] payload received, executing fills…");
  const report = await executeFills(reply.payload);
  console.log("[aijos] fill report:", {
    filled: report.filled.length,
    deferred: report.deferred.length,
    failed: report.failed,
  });
  console.log("[aijos] filled:", report.filled);
}

void main();
export {};
