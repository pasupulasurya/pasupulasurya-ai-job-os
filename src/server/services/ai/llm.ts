// src/server/services/ai/llm.ts
import type { z } from "zod";

export class LLMError extends Error {}
export class LLMRateLimitError extends LLMError {
  retryAfterMs?: number;
}
export class LLMTransportError extends LLMError {}
export class LLMAuthError extends LLMError {}
export class LLMValidationError extends LLMError {
  constructor(
    msg: string,
    public readonly rawOutput: string,
    options?: ErrorOptions,
  ) {
    super(msg, options);
  }
}

export interface LLMGenerateParams<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
}
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generate<T>(params: LLMGenerateParams<T>): Promise<T>;
}

let cached: LLMProvider | null = null;
export async function getLLMProvider(): Promise<LLMProvider> {
  if (cached) return cached;
  if (process.env.LLM_PROVIDER === "groq") {
    const { GroqProvider } = await import("./groq-provider");
    return (cached = new GroqProvider());
  }
  throw new LLMAuthError(`Unknown or unset LLM_PROVIDER: ${process.env.LLM_PROVIDER ?? "(unset)"}`);
}
