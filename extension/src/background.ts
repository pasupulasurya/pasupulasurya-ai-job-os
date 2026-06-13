// AI Job OS background service worker.
// 2H.1: fetch the fill payload from the app API using the user's
// existing web session (credentials: include). No tokens stored.
const APP_ORIGIN = "https://pasupulasurya-ai-job-os.vercel.app";

chrome.runtime.onMessage.addListener(
  (msg: { kind?: string; matchId?: string }, _sender, sendResponse) => {
    if (msg.kind === "aijos.getPayload" && msg.matchId) {
      void (async () => {
        try {
          const res = await fetch(`${APP_ORIGIN}/api/apply/${msg.matchId}/payload`, {
            credentials: "include",
          });
          if (!res.ok) {
            sendResponse({ ok: false, status: res.status });
            return;
          }
          const payload: unknown = await res.json();
          sendResponse({ ok: true, payload });
        } catch (e) {
          sendResponse({ ok: false, status: 0, error: String(e) });
        }
      })();
    }
    return true; // async sendResponse
  },
);
