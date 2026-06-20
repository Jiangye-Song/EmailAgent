import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Custom fetch that disables Qwen3's thinking/chain-of-thought mode.
 *
 * All Qwen3 models (qwen3.6-flash, qwen3.7-plus, qwen3.7-max) have thinking
 * enabled by default. This outputs a <think>…</think> reasoning block before
 * the actual response text, which breaks generateObject's JSON parser.
 *
 * Setting `enable_thinking: false` switches the models to direct-response mode,
 * which is what we need for structured output generation.
 */
const fetchNoThinking: typeof globalThis.fetch = async (url, options) => {
  if (options?.body && typeof options.body === "string") {
    try {
      const body = JSON.parse(options.body) as Record<string, unknown>;
      // Only inject on chat/text generation calls (not embeddings)
      if ("messages" in body) {
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

/**
 * Qwen Cloud provider using @ai-sdk/openai-compatible.
 *
 * We use openai-compatible (not @ai-sdk/openai) because:
 * - @ai-sdk/openai@beta (AI SDK 6) defaults to the OpenAI Responses API (/v1/responses)
 * - Qwen Cloud only implements the Chat Completions API (/v1/chat/completions)
 * - @ai-sdk/openai-compatible always uses Chat Completions — correct for all
 *   third-party OpenAI-compatible providers.
 */
const qwenProvider = createOpenAICompatible({
  name: "qwen",
  baseURL:
    process.env.QWEN_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY ?? "",
  fetch: fetchNoThinking,
});

// ─── Language models ──────────────────────────────────────────────────────────

/** Fast + cheap: email classification */
export const qwenFlash = qwenProvider.chatModel("qwen3.6-flash");

/** Balanced: summarization, todo extraction, draft replies */
export const qwenPlus = qwenProvider.chatModel("qwen3.7-plus");

/** Complex reasoning: rule evaluation, calendar parsing */
export const qwenMax = qwenProvider.chatModel("qwen3.7-max");

// ─── Embedding model ──────────────────────────────────────────────────────────

/** 1024-dim embeddings for pgvector semantic search (text-embedding-v4 default) */
export const qwenEmbedding = qwenProvider.textEmbeddingModel(
  "text-embedding-v4",
);

