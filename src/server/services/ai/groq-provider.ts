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

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  readonly model: string;
  private readonly apiKey: string;

  constructor() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new LLMAuthError("GROQ_API_KEY is not set");
    this.apiKey = key;
    this.model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;
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
