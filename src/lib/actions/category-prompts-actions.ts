"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { DEFAULT_CATEGORY_PROMPTS } from "@/lib/ai/category-prompts";

type CategoryPromptInput = {
  categoryKey: string;
  displayName: string;
  prompt: string;
};

type CategoryPromptRecord = {
  categoryKey: string;
  displayName: string;
  prompt: string;
};

function normalizeCategoryKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);
}

function sanitizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, 40);
}

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  return session.user.id;
}

export async function saveCategoryPrompts(items: CategoryPromptInput[]): Promise<void> {
  const userId = await getUserId();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of items) {
      const categoryKey = normalizeCategoryKey(item.categoryKey);
      const displayName = sanitizeDisplayName(item.displayName);

      if (!categoryKey || !displayName) continue;

      const prompt = item.prompt.trim() || DEFAULT_CATEGORY_PROMPTS[categoryKey] || "Use neutral analysis and extract practical next steps.";

      await client.query(
        `INSERT INTO user_categories (user_id, category_key, display_name, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, category_key)
         DO UPDATE SET display_name = EXCLUDED.display_name, is_active = true, updated_at = now()`,
        [userId, categoryKey, displayName],
      );

      await client.query(
        `INSERT INTO user_category_prompts (user_id, category, prompt)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, category)
         DO UPDATE SET prompt = EXCLUDED.prompt, updated_at = now()`,
        [userId, categoryKey, prompt],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/settings");
}

export async function addCategory(categoryName: string): Promise<CategoryPromptRecord> {
  const userId = await getUserId();
  const categoryKey = normalizeCategoryKey(categoryName);
  const displayName = sanitizeDisplayName(categoryName);

  if (categoryKey.length < 2) {
    throw new Error("Category name is too short.");
  }

  if (!displayName) {
    throw new Error("Category name is required.");
  }

  await pool.query(
    `INSERT INTO user_categories (user_id, category_key, display_name, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (user_id, category_key)
     DO UPDATE SET is_active = true, display_name = EXCLUDED.display_name, updated_at = now()`,
    [userId, categoryKey, displayName],
  );

  await pool.query(
    `INSERT INTO user_category_prompts (user_id, category, prompt)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category)
     DO NOTHING`,
    [
      userId,
      categoryKey,
      DEFAULT_CATEGORY_PROMPTS[categoryKey] ||
        "Use neutral analysis and extract practical next steps.",
    ],
  );

  const { rows } = await pool.query<{ prompt: string | null }>(
    `SELECT prompt
     FROM user_category_prompts
     WHERE user_id = $1 AND category = $2`,
    [userId, categoryKey],
  );

  const prompt =
    rows[0]?.prompt ??
    DEFAULT_CATEGORY_PROMPTS[categoryKey] ??
    "Use neutral analysis and extract practical next steps.";

  revalidatePath("/settings");

  return {
    categoryKey,
    displayName,
    prompt,
  };
}

export async function removeCategory(categoryKeyRaw: string): Promise<void> {
  const userId = await getUserId();
  const categoryKey = normalizeCategoryKey(categoryKeyRaw);

  if (!categoryKey) {
    throw new Error("Invalid category key.");
  }

  if (categoryKey === "other") {
    throw new Error('Category "other" cannot be deleted.');
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Ensure fallback category always exists and is active.
    await client.query(
      `INSERT INTO user_categories (user_id, category_key, display_name, is_active)
       VALUES ($1, 'other', 'Other', true)
       ON CONFLICT (user_id, category_key)
       DO UPDATE SET is_active = true, updated_at = now()`,
      [userId],
    );

    await client.query(
      `INSERT INTO user_category_prompts (user_id, category, prompt)
       VALUES ($1, 'other', $2)
       ON CONFLICT (user_id, category)
       DO NOTHING`,
      [
        userId,
        DEFAULT_CATEGORY_PROMPTS.other ||
          "Use neutral analysis and extract practical next steps.",
      ],
    );

    const { rows } = await client.query<{ active_count: string }>(
      `SELECT count(*)::text AS active_count
       FROM user_categories
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );

    const activeCount = Number(rows[0]?.active_count ?? 0);
    if (activeCount <= 1) {
      throw new Error("At least one category must remain.");
    }

    // Re-home existing emails from the deleted category to 'other'.
    await client.query(
      `UPDATE email_records
       SET category = 'other'
       WHERE user_id = $1 AND category = $2`,
      [userId, categoryKey],
    );

    await client.query(
      `DELETE FROM user_categories
       WHERE user_id = $1 AND category_key = $2`,
      [userId, categoryKey],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/settings");
  revalidatePath("/inbox");
}
