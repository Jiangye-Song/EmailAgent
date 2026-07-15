"use client";

import { useMemo, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
  alpha,
  Box,
  Chip,
  Divider,
  Dialog,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { markEmailRead, removeEmail, toggleStarEmail } from "@/lib/actions/email-actions";
import type { EmailActionButton, EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  onViewEmail: (id: string) => void;
};

function isToday(value: Date | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function displayCategory(category: string): string {
  return category
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ActionIcon({ action }: { action: EmailActionButton }) {
  if (action.kind === "star") return <StarRoundedIcon fontSize="small" />;
  if (action.kind === "remove") return <DeleteForeverRoundedIcon fontSize="small" />;
  if (action.kind === "reply") return <ReplyRoundedIcon fontSize="small" />;
  return <LaunchRoundedIcon fontSize="small" />;
}

export function NowPanel({ records, onViewEmail }: Props) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const todayRecords = useMemo(
    () => records.filter((record) => isToday(record.received_at)),
    [records],
  );
  const priorityToday = todayRecords.filter((record) => record.is_priority);
  const additionalUnreadPriorityCount =
    records.filter((record) => record.is_priority && !record.is_read).length - 1;
  const topCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of todayRecords) {
      const category = record.category?.trim() || "other";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [todayRecords]);

  const nextPriority = records.find(
    (record) => record.is_priority && !record.is_read && !dismissedIds.includes(record.id),
  );

  function runAction(action: EmailActionButton) {
    if (action.kind === "url" && action.href) {
      window.open(action.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (action.kind === "reply") {
      window.open(
        `mailto:${encodeURIComponent(nextPriority?.sender ?? "")}?subject=${encodeURIComponent(`Re: ${nextPriority?.subject ?? ""}`)}&body=${encodeURIComponent(nextPriority?.draft_body ?? "")}`,
        "_self",
      );
      return;
    }
    if (!nextPriority) return;
    startTransition(async () => {
      if (action.kind === "star") await toggleStarEmail(nextPriority.id);
      if (action.kind === "remove") {
        await removeEmail(nextPriority.id);
        setDismissedIds((ids) => [...ids, nextPriority.id]);
      }
    });
  }

  function handleMarkRead() {
    if (!nextPriority) return;
    setDismissedIds((ids) => [...ids, nextPriority.id]);
    startTransition(() => markEmailRead(nextPriority.id));
  }

  return (
    <>
      <Tooltip title="Now">
        <IconButton
          color={anchorEl ? "primary" : "inherit"}
          aria-label="Open Now panel"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <ListAltIcon />
        </IconButton>
      </Tooltip>
      <Dialog
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        maxWidth={false}
        slotProps={{
          paper: {
            sx: {
              width: "min(92vw, 1180px)",
              height: "min(88vh, 820px)",
              maxHeight: "none",
              m: 2,
              borderRadius: 1,
              overflow: "hidden",
            },
          },
        }}
      >
        <Paper
          sx={{
            width: "100%",
            height: "100%",
            maxHeight: "none",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ px: 2.5, py: 2 }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1}}>
                  Now
                </Typography>
              </Box>
              {additionalUnreadPriorityCount > 0 && (
                <Chip
                  label={`+${additionalUnreadPriorityCount}`}
                  size="small"
                  color="warning"
                />
              )}
            </Stack>
          </Box>
          <Divider />

          <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
            {nextPriority ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {nextPriority.sender}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 750, lineHeight: 1.25 }}>
                    {nextPriority.subject}
                  </Typography>
                  <Chip label={displayCategory(nextPriority.category)} size="small" sx={{ mt: 1 }} />
                </Box>
                <Box
                  sx={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "text.secondary",
                    "& p": { m: 0, mb: 1 },
                    "& p:last-child": { mb: 0 },
                    "& ul, & ol": { mt: 0.5, pl: 2.5 },
                  }}
                >
                  <ReactMarkdown>{nextPriority.summary || "No summary available."}</ReactMarkdown>
                </Box>
                <Stack direction="row" spacing={1} sx={{ pt: 0.5, justifyContent: "center" }}>
                  {(nextPriority.action_buttons ?? []).map((action, index) => (
                    <Tooltip key={`${action.kind}-${index}`} title={action.label}>
                      <span>
                        <IconButton
                          size="small"
                          color={action.kind === "remove" ? "error" : action.kind === "star" ? "warning" : "primary"}
                          aria-label={action.label}
                          disabled={isPending || (action.kind === "url" && !action.href)}
                          onClick={() => runAction(action)}
                          sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}
                        >
                          <ActionIcon action={action} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ))}
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", pt: 1 }}>
                  <Box sx={{ justifySelf: "start" }}>
                    <Tooltip title="View detail">
                      <IconButton size="small" aria-label="View email detail" onClick={() => { onViewEmail(nextPriority.id); setAnchorEl(null); }}>
                        <LaunchRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="caption" color="text.secondary">Priority email</Typography>
                  <Box sx={{ justifySelf: "end" }}>
                    <Tooltip title="Mark as read">
                      <IconButton size="small" color="primary" aria-label="Mark email as read" onClick={handleMarkRead} disabled={isPending}>
                        <MarkEmailReadRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Stack>
            ) : (
              <Box sx={{ py: 7, textAlign: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>You&apos;re all caught up</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  No unread priority emails right now.
                </Typography>
              </Box>
            )}
          </Box>

          <Divider />
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1}>
              <Box sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{todayRecords.length}</Typography>
                <Typography variant="caption" color="text.secondary">Emails today</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{priorityToday.length}</Typography>
                <Typography variant="caption" color="text.secondary">Priority today</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{topCategory?.[1] ?? 0}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {topCategory ? displayCategory(topCategory[0]) : "All"}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Dialog>
    </>
  );
}
