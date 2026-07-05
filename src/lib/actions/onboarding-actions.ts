"use server";

import { auth } from "@/auth";
import { pool } from "@/lib/db";

export type UseCaseId =
  | "work"
  | "career"
  | "personal"
  | "promotion"
  | "alert"
  | "documents";

type CategoryEntry = {
  key: string;
  displayName: string;
  prompt: string;
};

function buildCategories(
  selectedUseCases: UseCaseId[],
  answers: Partial<Record<UseCaseId, string>>,
): CategoryEntry[] {
  const categories: CategoryEntry[] = [];

  if (selectedUseCases.includes("work")) {
    const pos = answers.work?.trim();
    categories.push({
      key: "work",
      displayName: "Work",
      prompt: pos
        ? `I am working as a ${pos}.`
        : "Focus on work-related tasks, professional communication, and business matters.",
    });
  }

  if (selectedUseCases.includes("career")) {
    const pos = answers.career?.trim();
    const base =
      "Focus entirely on extracting open job roles, hiring companies, and application deadlines. Mark priority with job interview / important application updates.";
    categories.push({
      key: "career",
      displayName: "Career",
      prompt: pos ? `I am looking for career(s) in ${pos}. ${base}` : base,
    });
  }

  if (selectedUseCases.includes("personal")) {
    const personality = answers.personal?.trim();
    const base =
      "Prioritize relationship context and tone. Suggest a helpful draft reply when a response is implied or requested.";
    categories.push({
      key: "personal",
      displayName: "Personal",
      prompt: personality ? `I'm a person that ${personality}. ${base}` : base,
    });
  }

  if (selectedUseCases.includes("promotion")) {
    categories.push({
      key: "promotion",
      displayName: "Promotions",
      prompt:
        "Focus on deal quality, expiry, and whether action is worthwhile.",
    });
  }

  if (selectedUseCases.includes("alert")) {
    const location = answers.alert?.trim();
    const base =
      "Extract concrete risks, required actions, and deadlines. Mark priority true if user attention is needed soon.";
    categories.push({
      key: "alert",
      displayName: "Alerts",
      prompt: location ? `I usually live in ${location}. ${base}` : base,
    });
  }

  if (selectedUseCases.includes("documents")) {
    categories.push({
      key: "documents",
      displayName: "Documents",
      prompt:
        "Identify document type, attached files, and record-keeping relevance. Flag items requiring signatures, review, or filing. Note expiry dates and action deadlines.",
    });
  }

  // Always present
  categories.push({
    key: "other",
    displayName: "Other",
    prompt:
      "Use neutral analysis. Focus on key facts, required actions, and practical next steps.",
  });

  return categories;
}

export async function completeOnboarding(
  selectedUseCases: UseCaseId[],
  answers: Partial<Record<UseCaseId, string>>,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const categories = buildCategories(selectedUseCases, answers);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const cat of categories) {
      await client.query(
        `INSERT INTO user_categories (user_id, category_key, display_name, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, category_key)
         DO UPDATE SET display_name = EXCLUDED.display_name, is_active = true, updated_at = now()`,
        [userId, cat.key, cat.displayName],
      );

      await client.query(
        `INSERT INTO user_category_prompts (user_id, category, prompt)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, category)
         DO UPDATE SET prompt = EXCLUDED.prompt, updated_at = now()`,
        [userId, cat.key, cat.prompt],
      );
    }

    await client.query(
      `UPDATE users SET onboarding_completed = true WHERE id = $1`,
      [userId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
