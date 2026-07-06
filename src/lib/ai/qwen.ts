import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function contentHasJsonKeyword(content: unknown): boolean {
  if (typeof content === "string") {
    return /json/i.test(content);
  }

  if (Array.isArray(content)) {
    return content.some((part) => {
      if (typeof part === "string") {
        return /json/i.test(part);
      }

      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" && /json/i.test(text);
      }

      return false;
    });
  }

  return false;
}

function messagesIncludeJsonKeyword(messages: unknown[]): boolean {
  return messages.some((message) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const content = (message as { content?: unknown }).content;
    return contentHasJsonKeyword(content);
  });
}

function ensureJsonKeywordInMessages(messages: unknown[]): unknown[] {
  if (messagesIncludeJsonKeyword(messages)) {
    return messages;
  }

  const instruction = "Return valid JSON only.";
  const mutable = [...messages];
  const systemIndex = mutable.findIndex((message) => {
    if (!message || typeof message !== "object") return false;
    return (message as { role?: unknown }).role === "system";
  });

  if (systemIndex >= 0) {
    const systemMessage = mutable[systemIndex] as { content?: unknown };
    const systemContent = systemMessage.content;

    if (typeof systemContent === "string") {
      mutable[systemIndex] = {
        ...(mutable[systemIndex] as Record<string, unknown>),
        content: `${systemContent}\n\n${instruction}`,
      };
      return mutable;
    }
  }

  return [{ role: "system", content: instruction }, ...mutable];
}

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
      if ("messages" in body && Array.isArray(body.messages)) {
        body.enable_thinking = false;

        const responseFormat = body.response_format as { type?: unknown } | undefined;
        if (responseFormat?.type === "json_object") {
          body.messages = ensureJsonKeywordInMessages(body.messages);
        }
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

