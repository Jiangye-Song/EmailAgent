export const DEFAULT_CATEGORY_DEFINITIONS = [
  {
    key: "newsletter",
    label: "Newsletter",
    prompt:
      "Focus on updates, offers, and unsubscribe relevance. Keep summary concise and surface deadlines, promo codes, or confirmations.",
  },
  {
    key: "alert",
    label: "Alerts",
    prompt:
      "Treat as potentially urgent. Extract risks, required actions, and deadlines. Mark priority true when timely user attention is needed.",
  },
  {
    key: "personal",
    label: "Personal",
    prompt:
      "Prioritize relationship context and tone. Suggest a helpful draft reply when a response is implied or requested.",
  },
  {
    key: "promotion",
    label: "Promotions",
    prompt:
      "Focus on deal quality and expiry. Prefer archive when the value is low or irrelevant.",
  },
  {
    key: "other",
    label: "Other",
    prompt:
      "Use neutral analysis. Focus on key facts, required actions, and practical next steps.",
  },
] as const;

export const DEFAULT_CATEGORY_PROMPTS = Object.fromEntries(
  DEFAULT_CATEGORY_DEFINITIONS.map((item) => [item.key, item.prompt]),
) as Record<string, string>;
