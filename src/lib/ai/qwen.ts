import OpenAI from "openai";

/**
 * Custom fetch that disables Qwen3's thinking/chain-of-thought mode.
 *
 * All Qwen3 models (qwen3.6-flash, qwen3.7-plus, qwen3.7-max) have thinking
 * enabled by default. This outputs a <think>…</think> reasoning block before
 * the actual response text, which breaks JSON parsing.
 *
 * Setting `enable_thinking: false` switches the models to direct-response mode.
 */
const fetchNoThinking: typeof globalThis.fetch = async (url, options) => {
  if (options?.body && typeof options.body === "string") {
    try {
      const body = JSON.parse(options.body) as Record<string, unknown>;
      // Only inject on chat/text generation calls (not embeddings)
      if ("messages" in body && Array.isArray(body.messages)) {
        body.enable_thinking = false;
      }
      return globalThis.fetch(url as string, {
        ...(options as RequestInit),
        body: JSON.stringify(body),
      });
    } catch {
      // Body wasn't valid JSON — pass through unchanged
    }
  }
  return globalThis.fetch(url as string, options as RequestInit);
};

export const qwenClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY ?? "",
  baseURL:
    process.env.QWEN_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  fetch: fetchNoThinking,
});

// ─── Model name constants ─────────────────────────────────────────────────────

/** Fast + cheap: email classification */
export const QWEN_FLASH = "qwen3.6-flash";

/** Balanced: summarization, todo extraction, draft replies */
export const QWEN_PLUS = "qwen3.7-plus";

/** Complex reasoning: rule evaluation, calendar parsing */
export const QWEN_MAX = "qwen3.7-max";

/** 1024-dim embeddings for pgvector semantic search */
export const QWEN_EMBEDDING = "text-embedding-v4";

