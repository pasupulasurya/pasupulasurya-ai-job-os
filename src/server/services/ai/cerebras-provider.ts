// src/server/services/ai/cerebras-provider.ts
import {
  LLMAuthError,
  LLMRateLimitError,
  LLMTransportError,
  LLMValidationError,
  type LLMGenerateParams,
  type LLMProvider,
} from "./llm";

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
const DEFAULT_MODEL = "gpt-oss-120b";
const BACKOFF_MS = [500, 1500, 4500];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Cerebras's free tier (verified 2026-06-09 via /v1/models + test call):
 *   5 req/min, 150 req/hr, 2,400 req/day
 *   30K tokens/min, 1M tokens/hr, 1M tokens/day
 *
 * Available models: gpt-oss-120b, zai-glm-4.7 (both reasoning models —
 * chain-of-thought consumes tokens before output, so default maxTokens
 * is intentionally higher than Groq's 512).
 *
 * Headers returned by every response:
 *   x-ratelimit-remaining-{requests,tokens}-{minute,hour,day}
 *   x-ratelimit-limit-{requests,tokens}-{minute,hour,day}
 *
 * Throttle strategy: track minute-window remaining tokens + requests.
 * Hour/day windows are large enough that minute is the binding constraint
 * for friend-scale beta. If minute headroom is exhausted, sleep until the
 * next minute boundary (Cerebras doesn't return a reset timestamp — we
 * conservatively wait 60s).
 */
export class CerebrasProvider implements LLMProvider {
  readonly name = "cerebras";
  readonly model: string;
  private readonly apiKey: string;

  // Minute-window state, updated after every response.
  private remainingTokensMinute: number | null = null;
  private remainingRequestsMinute: number | null = null;
  // Track when state was last updated so we know when to expire it.
  private rateLimitUpdatedAt: number | null = null;

  constructor() {
    const key = process.env.CEREBRAS_API_KEY;
    if (!key) throw new LLMAuthError("CEREBRAS_API_KEY is not set");
    this.apiKey = key;
    this.model = process.env.CEREBRAS_MODEL ?? DEFAULT_MODEL;
  }

  /**
   * Pre-flight: if minute-window is exhausted, sleep until it resets.
   * State older than 60s is stale — we treat that as "fire and learn."
   */
  private async waitForHeadroom(estimatedTokens: number): Promise<void> {
    if (this.rateLimitUpdatedAt === null) return;
    const ageMs = Date.now() - this.rateLimitUpdatedAt;
    if (ageMs >= 60_000) {
      // State is stale; minute window has reset
      this.remainingTokensMinute = null;
      this.remainingRequestsMinute = null;
      this.rateLimitUpdatedAt = null;
      return;
    }

    const tokensBlocked =
      this.remainingTokensMinute !== null && this.remainingTokensMinute < estimatedTokens;
    const requestsBlocked =
      this.remainingRequestsMinute !== null && this.remainingRequestsMinute < 1;

    if (tokensBlocked || requestsBlocked) {
      const sleepMs = 60_000 - ageMs + 100; // wait until minute window resets + 100ms buffer
      await sleep(sleepMs);
      this.remainingTokensMinute = null;
      this.remainingRequestsMinute = null;
      this.rateLimitUpdatedAt = null;
    }
  }

  /**
   * Parse minute-window rate-limit headers and update internal state.
   * Called after both 200s and 429s. Silently no-ops on unparseable headers.
   */
  private updateRateLimitState(headers: Headers): void {
    const tokensRaw = headers.get("x-ratelimit-remaining-tokens-minute");
    const requestsRaw = headers.get("x-ratelimit-remaining-requests-minute");

    let updated = false;
    if (tokensRaw !== null) {
      const n = Number(tokensRaw);
      if (Number.isFinite(n)) {
        this.remainingTokensMinute = Math.floor(n);
        updated = true;
      }
    }
    if (requestsRaw !== null) {
      const n = Number(requestsRaw);
      if (Number.isFinite(n)) {
        this.remainingRequestsMinute = Math.floor(n);
        updated = true;
      }
    }
    if (updated) this.rateLimitUpdatedAt = Date.now();
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
    // Default maxTokens is 2048 — reasoning models on Cerebras spend
    // ~50-70% of completion budget on chain-of-thought before output.
    const { system, user, temperature = 0, maxTokens = 2048, timeoutMs = 60_000 } = params;

    // Worst-case estimate: maxTokens for response + prompt overhead.
    const estimatedTokens = maxTokens * 2;
    await this.waitForHeadroom(estimatedTokens);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(CEREBRAS_URL, {
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
      throw new LLMTransportError(`Cerebras request failed: ${(err as Error).message}`, {
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    // Update state from headers BEFORE checking status — learn from 429s too.
    this.updateRateLimitState(res.headers);

    if (res.status === 401 || res.status === 403)
      throw new LLMAuthError(`Cerebras auth failed: ${res.status}`);
    if (res.status === 429) {
      const headerVal = res.headers.get("retry-after");
      const retryAfterMs = headerVal ? Math.max(0, Number(headerVal) * 1000) : undefined;
      const rateErr = new LLMRateLimitError(`Cerebras rate limit: 429`);
      if (retryAfterMs !== undefined && Number.isFinite(retryAfterMs))
        rateErr.retryAfterMs = retryAfterMs;
      throw rateErr;
    }
    if (res.status >= 500) throw new LLMTransportError(`Cerebras server error: ${res.status}`);
    if (!res.ok) throw new LLMTransportError(`Cerebras unexpected status: ${res.status}`);

    let envelope: unknown;
    try {
      envelope = await res.json();
    } catch (err) {
      throw new LLMTransportError("Cerebras returned non-JSON envelope", { cause: err });
    }
    const content = (envelope as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LLMValidationError(
        "Cerebras envelope missing choices[0].message.content",
        JSON.stringify(envelope),
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new LLMValidationError("Cerebras content was not valid JSON", content, { cause: err });
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
