// AI Job OS content script — runs on greenhouse.io job pages.
// 2H.1 shell: detect the apply marker, handshake with the worker.
// Fill execution lands in 2H.2; this proves the plumbing.

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
    kind: "aijos.handshake",
    matchId,
  })) as { ok: boolean; echo: string };
  console.log("[aijos] worker handshake:", reply);
}

void main();
