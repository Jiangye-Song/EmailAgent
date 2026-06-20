import { createOpenAI } from "@ai-sdk/openai";

/**
 * Single Qwen Cloud provider instance.
 * Uses the international DashScope endpoint (OpenAI-compatible).
 */
const qwenProvider = createOpenAI({
  baseURL:
    process.env.QWEN_BASE_URL ??
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY ?? "",
});

// ─── Language models ──────────────────────────────────────────────────────────

/** Fast + cheap: email classification */
export const qwenFlash = qwenProvider("qwen3.6-flash");

/** Balanced: summarization, todo extraction, draft replies */
export const qwenPlus = qwenProvider("qwen3.7-plus");

/** Complex reasoning: rule evaluation, calendar parsing */
export const qwenMax = qwenProvider("qwen3.7-max");

// ─── Embedding model ──────────────────────────────────────────────────────────

/** 1536-dim embeddings for pgvector semantic search */
export const qwenEmbedding = qwenProvider.textEmbeddingModel(
  "text-embedding-v4",
);
