"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { saveRules } from "@/lib/actions/rules-actions";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

const EXAMPLES = [
  "Always keep emails from school",
  "Archive promotions unless discount > 40%",
  "Never send emails without my approval",
  "Flag emails related to jobs, invoices, and interviews",
];

type Props = {
  initialRules: string[];
};

export function RulesEditor({ initialRules }: Props) {
  const [rules, setRules] = useState<string[]>(
    initialRules.length > 0 ? initialRules : [""],
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const updateRule = (index: number, value: string) => {
    setRules((prev) => prev.map((r, i) => (i === index ? value : r)));
    setSaved(false);
  };

  const addRule = () => {
    setRules((prev) => [...prev, ""]);
    setSaved(false);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const addExample = (example: string) => {
    setRules((prev) => {
      // Replace last empty rule or append
      const lastEmpty = prev.findLastIndex((r) => !r.trim());
      if (lastEmpty >= 0) {
        return prev.map((r, i) => (i === lastEmpty ? example : r));
      }
      return [...prev, example];
    });
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveRules(rules);
      setSaved(true);
    });
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1.4}>
        {rules.map((rule, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              value={rule}
              onChange={(e) => updateRule(i, e.target.value)}
              placeholder={`Rule ${i + 1} — e.g. "Archive all newsletters"`}
              multiline
              minRows={2}
              fullWidth
            />
            <IconButton
              color="error"
              onClick={() => removeRule(i)}
              disabled={rules.length === 1}
              sx={{ mt: 0.5 }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Button variant="outlined" size="small" onClick={addRule} startIcon={<AddRoundedIcon />} sx={{ alignSelf: "flex-start" }}>
        Add rule
      </Button>

      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Examples — click to add
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
          {EXAMPLES.map((ex) => (
            <Chip
              key={ex}
              label={ex}
              variant="outlined"
              onClick={() => addExample(ex)}
              sx={{ cursor: "pointer" }}
            >
            </Chip>
          ))}
        </Stack>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", sm: "center" } }}
      >
        <Button onClick={handleSave} disabled={isPending} variant="contained" startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}>
          {isPending ? (
            "Saving..."
          ) : (
            "Save rules"
          )}
        </Button>
        {saved && (
          <Alert severity="success" sx={{ py: 0 }}>
            Rules saved. The next digest will apply them.
          </Alert>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Rules are evaluated by qwen3.7-max against each email during processing. Use plain language and specific instructions.
      </Typography>
    </Stack>
  );
}
