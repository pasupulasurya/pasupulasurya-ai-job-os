// src/server/services/ai/groq-provider.ts
import {
  LLMAuthError,
  LLMRateLimitError,
  LLMTransportError,
  LLMValidationError,
  type LLMGenerateParams,
  type LLMProvider,
} from "./llm";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const BACKOFF_MS = [500, 1500, 4500];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Parse Groq's reset-window header strings into milliseconds.
 * Groq returns values like "459ms", "6s", "1m30s", "2h" in
 * x-ratelimit-reset-tokens / x-ratelimit-reset-requests.
 * Returns null if unparseable.
 */
function parseResetWindow(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  // Bare number, treat as seconds (defensive — not seen in practice)
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  // Match unit-suffixed groups, e.g. "1m30s" -> [1m, 30s]
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    matched = true;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    switch (m[2]) {
      case "ms":
        total += n;
        break;
      case "s":
        total += n * 1000;
        break;
      case "m":
        total += n * 60_000;
        break;
      case "h":
        total += n * 3_600_000;
        break;
    }
  }
  return matched ? Math.round(total) : null;
}

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  readonly model: string;
  private readonly apiKey: string;

  // Token-budget state, updated from rate-limit headers after every response.
  // When remainingTokens drops below the worst-case estimate for the next
  // call, we sleep until the reset window passes. Initialized null — treated
  // as "no info yet, fire the first request and learn from the response."
  private remainingTokens: number | null = null;
  private resetTokensAt: number | null = null;
  private remainingRequests: number | null = null;
  private resetRequestsAt: number | null = null;

  constructor() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new LLMAuthError("GROQ_API_KEY is not set");
    this.apiKey = key;
    this.model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  }

  /**
   * Pre-flight: if we know we don't have headroom in the current rate-limit
   * window, sleep until the window resets. estimatedTokens is conservative
   * worst-case (maxTokens * 2 covers prompt + response). No-ops if state
   * is unknown (first call) or if headroom is fine.
   */
  private async waitForHeadroom(estimatedTokens: number): Promise<void> {
    const now = Date.now();
    if (this.remainingTokens !== null && this.resetTokensAt !== null) {
      if (this.remainingTokens < estimatedTokens && this.resetTokensAt > now) {
        const sleepMs = this.resetTokensAt - now + 100; // 100ms safety buffer
        await sleep(sleepMs);
        this.remainingTokens = null;
        this.resetTokensAt = null;
      }
    }
    if (this.remainingRequests !== null && this.resetRequestsAt !== null) {
      if (this.remainingRequests < 1 && this.resetRequestsAt > Date.now()) {
        const sleepMs = this.resetRequestsAt - Date.now() + 100;
        await sleep(sleepMs);
        this.remainingRequests = null;
        this.resetRequestsAt = null;
      }
    }
  }

  /**
   * Parse rate-limit headers from a response and update internal state.
   * Called after both 200s and 429s. Silently no-ops on unparseable headers.
   */
  private updateRateLimitState(headers: Headers): void {
    const remainingTokensRaw = headers.get("x-ratelimit-remaining-tokens");
    const resetTokensRaw = headers.get("x-ratelimit-reset-tokens");
    const remainingRequestsRaw = headers.get("x-ratelimit-remaining-requests");
    const resetRequestsRaw = headers.get("x-ratelimit-reset-requests");

    if (remainingTokensRaw !== null) {
      const n = Number(remainingTokensRaw);
      if (Number.isFinite(n)) this.remainingTokens = Math.floor(n);
    }
    const resetTokensMs = parseResetWindow(resetTokensRaw);
    if (resetTokensMs !== null) this.resetTokensAt = Date.now() + resetTokensMs;

    if (remainingRequestsRaw !== null) {
      const n = Number(remainingRequestsRaw);
      if (Number.isFinite(n)) this.remainingRequests = Math.floor(n);
    }
    const resetRequestsMs = parseResetWindow(resetRequestsRaw);
    if (resetRequestsMs !== null) this.resetRequestsAt = Date.now() + resetRequestsMs;
  }

  async generate<T>(params: LLMGenerateParams<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      try {
        return await this.generateOnce(params);
      } catch (err) {
        lastErr = err;
        const retriable = err instanceof LLMRateLimitError || err instanceof LLMTransportError;
        if (!retriable) throw err;
        if (attempt === BACKOFF_MS.length - 1) break;
        const hinted = err instanceof LLMRateLimitError ? err.retryAfterMs : undefined;
        await sleep(hinted ?? BACKOFF_MS[attempt]);
      }
    }
    throw lastErr;
  }

  private async generateOnce<T>(params: LLMGenerateParams<T>): Promise<T> {
    const { system, user, temperature = 0, maxTokens = 512, timeoutMs = 30_000 } = params;

    // Worst-case token estimate: maxTokens for response + maxTokens for
    // prompt. Groq counts both directions. 2x is a safe upper bound.
    const estimatedTokens = maxTokens * 2;
    await this.waitForHeadroom(estimatedTokens);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: params.model ?? this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new LLMTransportError(`Groq request failed: ${(err as Error).message}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }

    // Update state from headers BEFORE checking status — learn from 429s too.
    this.updateRateLimitState(res.headers);

    if (res.status === 401 || res.status === 403)
      throw new LLMAuthError(`Groq auth failed: ${res.status}`);
    if (res.status === 429) {
      const headerVal = res.headers.get("retry-after");
      const retryAfterMs = headerVal ? Math.max(0, Number(headerVal) * 1000) : undefined;
      const rateErr = new LLMRateLimitError(`Groq rate limit: 429`);
      if (retryAfterMs !== undefined && Number.isFinite(retryAfterMs))
        rateErr.retryAfterMs = retryAfterMs;
      throw rateErr;
    }
    if (res.status >= 500) throw new LLMTransportError(`Groq server error: ${res.status}`);
    if (!res.ok) throw new LLMTransportError(`Groq unexpected status: ${res.status}`);
    let envelope: unknown;
    try {
      envelope = await res.json();
    } catch (err) {
      throw new LLMTransportError("Groq returned non-JSON envelope", { cause: err });
    }
    const content = (envelope as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LLMValidationError(
        "Groq envelope missing choices[0].message.content",
        JSON.stringify(envelope),
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new LLMValidationError("Groq content was not valid JSON", content, { cause: err });
    }
    const result = params.schema.safeParse(parsed);
    if (!result.success) {
      throw new LLMValidationError(`Zod validation failed: ${result.error.message}`, content, {
        cause: result.error,
      });
    }
    return result.data;
  }
}
