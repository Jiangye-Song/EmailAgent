"use client";

import { ReactNode, useState, useTransition } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  markEmailUnread,
  removeEmail,
  toggleStarEmail,
} from "@/lib/actions/email-actions";
import type { EmailActionButton, EmailRecord } from "@/types/db";

type Props = {
  record: EmailRecord | null;
  forwardingAddress: string;
};

type FoldableSectionProps = {
  title: string;
  titleColor: string;
  defaultExpanded?: boolean;
  borderColor?: string;
  children: ReactNode;
};

function FoldableSection({
  title,
  titleColor,
  defaultExpanded = true,
  borderColor,
  children,
}: FoldableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: "hidden",
        ...(borderColor
          ? {
              borderLeft: "4px solid",
              borderLeftColor: borderColor,
            }
          : {}),
      }}
    >
      <Button
        fullWidth
        variant="text"
        color="inherit"
        onClick={() => setIsExpanded((value) => !value)}
        sx={{
          justifyContent: "flex-start",
          px: 2,
          py: 1,
          borderRadius: 0,
          color: "text.secondary",
        }}
        startIcon={
          isExpanded ? (
            <ExpandMoreRoundedIcon fontSize="small" />
          ) : (
            <ChevronRightRoundedIcon fontSize="small" />
          )
        }
      >
        <Typography
          variant="overline"
          color={titleColor}
          sx={{ fontWeight: 700 }}
        >
          {title}
        </Typography>
      </Button>
      <Divider />
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Paper>
  );
}

function toneToColor(
  tone: EmailActionButton["tone"],
): "inherit" | "primary" | "secondary" | "success" | "warning" | "error" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "error";
    case "accent":
      return "secondary";
    default:
      return "primary";
  }
}

export function EmailDetail({ record, forwardingAddress }: Props) {
  const [isPending, startTransition] = useTransition();
  const [localRead, setLocalRead] = useState<boolean | null>(null);
  const [localStarred, setLocalStarred] = useState<boolean | null>(null);

  if (!record) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          p: 3,
          textAlign: "center",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="body1" color="text.secondary">
            Select an email to read
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Forward your emails to <b>{forwardingAddress}</b>
          </Typography>
        </Stack>
      </Box>
    );
  }

  const rec = record;
  const isRead = localRead ?? rec.is_read;
  const isStarred = localStarred ?? rec.is_starred;

  const mailtoUrl =
    `mailto:${encodeURIComponent(rec.sender)}` +
    `?subject=${encodeURIComponent(`Re: ${rec.subject}`)}` +
    `&body=${encodeURIComponent(rec.draft_body ?? "")}`;

  function handleToggleStar() {
    startTransition(async () => {
      await toggleStarEmail(rec.id);
      setLocalStarred((value) => !(value ?? rec.is_starred));
    });
  }

  function handleMarkUnread() {
    startTransition(async () => {
      await markEmailUnread(rec.id);
      setLocalRead(false);
    });
  }

  function handleRemove() {
    if (!window.confirm("Remove this email permanently? This cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      await removeEmail(rec.id);
      setLocalRead(true);
    });
  }

  function runButtonAction(action: EmailActionButton) {
    if (action.kind === "star") {
      handleToggleStar();
      return;
    }

    if (action.kind === "remove") {
      handleRemove();
      return;
    }

    if (action.kind === "reply") {
      window.open(mailtoUrl, "_self");
      return;
    }

    if (action.kind === "url" && action.href) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    }
  }

  const hasCalendar =
    Array.isArray(rec.calendar_events) && rec.calendar_events.length > 0;

  const actionButtons = Array.isArray(rec.action_buttons)
    ? rec.action_buttons
    : [];

  return (
    <Stack sx={{ height: "100%", minWidth: 0 }}>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" sx={{ mb: 0.75, fontWeight: isRead ? 600 : 800 }}>
          {rec.subject}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Typography variant="body2" color="text.secondary">
            <Box
              component="span"
              sx={{ color: "text.primary", fontWeight: 600 }}
            >
              From:
            </Box>{" "}
            {rec.sender}
          </Typography>
          {rec.received_at && (
            <Typography variant="body2" color="text.secondary">
              {new Date(rec.received_at).toLocaleString()}
            </Typography>
          )}
          <Chip
            label={rec.category}
            size="small"
            sx={{ textTransform: "capitalize" }}
          />
          {isStarred && <Chip label="Starred" size="small" color="warning" />}
          {!isRead && <Chip label="Unread" size="small" color="primary" />}
        </Stack>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          flexWrap: "wrap",
          px: { xs: 2, md: 3 },
          py: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Button
          variant={isStarred ? "contained" : "outlined"}
          color="warning"
          size="small"
          startIcon={
            isStarred ? (
              <StarRoundedIcon fontSize="small" />
            ) : (
              <StarBorderRoundedIcon fontSize="small" />
            )
          }
          onClick={handleToggleStar}
          disabled={isPending}
        >
          {isStarred ? "Unstar" : "Star"}
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<MarkEmailUnreadRoundedIcon fontSize="small" />}
          onClick={handleMarkUnread}
          disabled={isPending}
        >
          Mark Unread
        </Button>

        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteForeverRoundedIcon fontSize="small" />}
          onClick={handleRemove}
          disabled={isPending}
        >
          Remove
        </Button>

        <Button
          component="a"
          href={mailtoUrl}
          variant="outlined"
          size="small"
          startIcon={<ReplyRoundedIcon fontSize="small" />}
        >
          Reply
        </Button>

        {hasCalendar && (
          <Button
            component="a"
            href={`/api/ics/${rec.id}`}
            download
            variant="outlined"
            size="small"
            startIcon={<EventRoundedIcon fontSize="small" />}
          >
            Add to Cal
          </Button>
        )}
      </Stack>

      <Box sx={{ overflowY: "auto", p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <FoldableSection
            title="Summary"
            titleColor="primary.main"
            borderColor="primary.main"
          >
            <Box
              sx={{
                p: 2,
                fontSize: 14,
                lineHeight: 1.7,
                "& p": { m: 0, mb: 1 },
                "& p:last-child": { mb: 0 },
                "& ul, & ol": { mt: 0.5, mb: 1, pl: 2.5 },
                "& a": { color: "primary.main" },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {rec.summary || "No summary available."}
              </ReactMarkdown>
            </Box>
          </FoldableSection>

          {rec.todos?.length > 0 && (
            <FoldableSection
              title="Action Items"
              titleColor="warning.main"
              borderColor="warning.main"
            >
              <Box
                sx={{
                  p: 2,
                  fontSize: 14,
                  lineHeight: 1.7,
                  "& p": { m: 0, mb: 0.5 },
                  "& ul, & ol": { mt: 0.5, mb: 1, pl: 2.5 },
                  "& a": { color: "primary.main" },
                }}
              >
                {rec.todos.map((todo, i) => (
                  <Box key={i} sx={{ mb: 1.25 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {`- ${todo}`}
                    </ReactMarkdown>
                  </Box>
                ))}

                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  {actionButtons.map((action, index) => (
                    <Button
                      key={`${action.kind}-${index}`}
                      size="small"
                      variant="contained"
                      color={
                        action.kind === "star"
                          ? "warning"
                          : action.kind === "remove"
                            ? "error"
                            : action.kind === "reply"
                              ? "primary"
                              : toneToColor(action.tone)
                      }
                      startIcon={
                        action.kind === "star" ? (
                          <StarRoundedIcon fontSize="small" />
                        ) : action.kind === "remove" ? (
                          <DeleteForeverRoundedIcon fontSize="small" />
                        ) : action.kind === "reply" ? (
                          <ReplyRoundedIcon fontSize="small" />
                        ) : undefined
                      }
                      onClick={() => runButtonAction(action)}
                      disabled={isPending || (action.kind === "url" && !action.href)}
                    >
                      {action.kind === "star"
                        ? "Star"
                        : action.kind === "remove"
                          ? "Remove"
                          : action.kind === "reply"
                            ? "Reply"
                            : action.label}
                    </Button>
                  ))}

                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={handleToggleStar}
                    disabled={isPending}
                  >
                    {isStarred ? "Unstar" : "Star"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleRemove}
                    disabled={isPending}
                  >
                    Remove
                  </Button>
                  <Button
                    component="a"
                    href={mailtoUrl}
                    size="small"
                    variant="outlined"
                    disabled={isPending}
                  >
                    Reply
                  </Button>
                </Stack>
              </Box>
            </FoldableSection>
          )}

          {rec.draft_body && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderLeft: "4px solid",
                borderLeftColor: "info.main",
              }}
            >
              <Box sx={{ p: 2 }}>
                <Typography
                  variant="overline"
                  color="info.main"
                  sx={{ fontWeight: 700 }}
                >
                  Draft Reply
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "pre-wrap" }}
                >
                  {rec.draft_body}
                </Typography>
              </Box>
            </Paper>
          )}

          {hasCalendar && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderLeft: "4px solid",
                borderLeftColor: "success.main",
              }}
            >
              <Typography
                variant="overline"
                color="success.main"
                sx={{ fontWeight: 700 }}
              >
                Calendar Events
              </Typography>
              <List dense disablePadding>
                {rec.calendar_events?.map((evt, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.2 }}>
                    <ListItemText
                      primary={evt.title}
                      slotProps={{
                        primary: { variant: "body2", sx: { fontWeight: 600 } },
                        secondary: { variant: "caption" },
                      }}
                      secondary={
                        <>
                          {new Date(evt.start).toLocaleString()}
                          {evt.end
                            ? ` → ${new Date(evt.end).toLocaleString()}`
                            : ""}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {rec.raw_body && (
            <FoldableSection
              title="Original Email"
              titleColor="text.secondary"
              defaultExpanded={false}
              borderColor="divider"
            >
              <Box
                sx={{
                  p: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(15, 23, 42, 0.82)"
                      : "grey.50",
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "text.primary",
                    lineHeight: 1.6,
                  }}
                >
                  {rec.raw_body}
                </Typography>
              </Box>
            </FoldableSection>
          )}

          {isPending && (
            <Alert severity="info">Updating email...</Alert>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
