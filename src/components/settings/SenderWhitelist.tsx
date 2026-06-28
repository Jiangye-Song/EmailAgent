"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  addWhitelistSender,
  deleteWhitelistSender,
} from "@/lib/actions/sender-whitelist-actions";

type WhitelistEntry = {
  id: string;
  senderEmail: string;
  senderDomain: string | null;
};

type Props = {
  initialEntries: WhitelistEntry[];
};

function displayEntry(entry: WhitelistEntry): string {
  if (entry.senderEmail.startsWith("*@") && entry.senderDomain) {
    return `@${entry.senderDomain}`;
  }
  return entry.senderEmail;
}

export function SenderWhitelist({ initialEntries }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderedEntries = useMemo(
    () => [...initialEntries].sort((a, b) => displayEntry(a).localeCompare(displayEntry(b))),
    [initialEntries],
  );

  const onAdd = () => {
    const value = input.trim();
    if (!value) return;

    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        await addWhitelistSender(value);
        setInput("");
        setMessage("Sender added to whitelist.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add sender");
      }
    });
  };

  const onDelete = (entry: WhitelistEntry) => {
    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);
        await deleteWhitelistSender(entry.id);
        setMessage("Sender removed.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove sender");
      }
    });
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
        <TextField
          fullWidth
          label="Forwarding sender"
          placeholder="your-mailbox@example.com or example.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          helperText="Enter the mailbox that sends the forward into your agent address (or allow its domain)."
        />
        <Button
          variant="contained"
          onClick={onAdd}
          disabled={isPending || !input.trim()}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <AddRoundedIcon />}
          sx={{ minWidth: { sm: 140 } }}
        >
          Add
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {orderedEntries.map((entry) => (
          <Chip
            key={entry.id}
            label={displayEntry(entry)}
            onDelete={() => onDelete(entry)}
            deleteIcon={<DeleteOutlineRoundedIcon />}
            variant="outlined"
          />
        ))}
      </Stack>

      {orderedEntries.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No forwarding sender is whitelisted yet.
        </Typography>
      )}

      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
