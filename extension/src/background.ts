// AI Job OS background service worker.
// 2H.1 shell: answer the content-script handshake.
// API payload fetching lands in 2H.2.

chrome.runtime.onMessage.addListener(
  (msg: { kind?: string; matchId?: string }, _sender, sendResponse) => {
    if (msg.kind === "aijos.handshake") {
      console.log("[aijos:worker] handshake from content, matchId:", msg.matchId);
      sendResponse({ ok: true, echo: msg.matchId });
    }
    return true; // keep channel open for async sendResponse
  },
);
