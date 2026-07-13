"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  addCategory,
  removeCategory,
  saveCategoryPrompts,
} from "@/lib/actions/category-prompts-actions";
import { sortCategoriesWithOtherLast } from "@/lib/categories";

type Props = {
  initialCategories: {
    categoryKey: string;
    displayName: string;
    prompt: string;
  }[];
};

export function CategoryPromptsEditor({ initialCategories }: Props) {
  const [items, setItems] = useState(() => sortCategoriesWithOtherLast(initialCategories));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updatePrompt(categoryKey: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.categoryKey === categoryKey ? { ...item, prompt: value } : item,
      ),
    );
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        setError(null);
        await saveCategoryPrompts(items);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save category prompts");
      }
    });
  }

  function handleAddCategory() {
    const value = newCategoryName.trim();
    if (!value) return;

    startTransition(async () => {
      try {
        setError(null);
        const created = await addCategory(value);
        setItems((prev) => {
          const next = prev.filter((item) => item.categoryKey !== created.categoryKey);
          return sortCategoriesWithOtherLast([...next, created]);
        });
        setNewCategoryName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add category");
      }
    });
  }

  function handleRemoveCategory(categoryKey: string) {
    startTransition(async () => {
      try {
        setError(null);
        await removeCategory(categoryKey);
        setItems((prev) => sortCategoriesWithOtherLast(prev.filter((item) => item.categoryKey !== categoryKey)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove category");
      }
    });
  }

  function shouldShowCategoryKey(item: { categoryKey: string; displayName: string }): boolean {
    const normalizedDisplayName = item.displayName.trim().toLowerCase().replace(/\s+/g, "-");
    return normalizedDisplayName !== item.categoryKey;
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Add or remove categories, then customize prompts for each category. These prompts are used by the second AI agent after category classification.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
        <TextField
          fullWidth
          label="New category"
          placeholder="Example: Finance"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
        />
        <Button
          variant="outlined"
          onClick={handleAddCategory}
          disabled={isPending || !newCategoryName.trim()}
          startIcon={<AddRoundedIcon />}
          sx={{ minWidth: { sm: 160 } }}
        >
          Add category
        </Button>
      </Stack>

      <Stack spacing={2}>
        {items.map((item) => (
          <Box key={item.categoryKey}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.8 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                {item.displayName}
              </Typography>
              {shouldShowCategoryKey(item) && (
                <Typography variant="caption" color="text.secondary">
                  {item.categoryKey}
                </Typography>
              )}
              {item.categoryKey !== "other" && (
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => handleRemoveCategory(item.categoryKey)}
                  disabled={isPending}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <TextField
              value={item.prompt}
              onChange={(e) => updatePrompt(item.categoryKey, e.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder={`Prompt instructions for ${item.displayName}`}
            />
          </Box>
        ))}
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
        <Button
          onClick={handleSave}
          disabled={isPending}
          variant="contained"
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
        >
          {isPending ? "Saving..." : "Save category prompts"}
        </Button>
        {saved && (
          <Alert severity="success" sx={{ py: 0 }}>
            Category prompts saved.
          </Alert>
        )}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
