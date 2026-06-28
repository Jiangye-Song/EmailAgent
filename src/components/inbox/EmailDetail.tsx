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
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { approveAction, rejectAction } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";

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

export function EmailDetail({ record, forwardingAddress }: Props) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

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

  // After the null guard above, record is non-null for the rest of the component.
  // Capture it in a const so closures below don't see the nullable type.
  const rec = record;

  const status = localStatus ?? rec.action_status;

  const mailtoUrl =
    `mailto:${encodeURIComponent(rec.sender)}` +
    `?subject=${encodeURIComponent(`Re: ${rec.subject}`)}` +
    `&body=${encodeURIComponent(rec.draft_body ?? "")}`;

  function handleApprove() {
    startTransition(async () => {
      await approveAction(rec.id);
      setLocalStatus("executed");
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectAction(rec.id);
      setLocalStatus("rejected");
    });
  }

  const hasCalendar =
    Array.isArray(rec.calendar_events) && rec.calendar_events.length > 0;

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
        <Typography variant="h6" sx={{ mb: 0.75 }}>
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
        {status === "pending" ? (
          <>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckCircleRoundedIcon fontSize="small" />}
              onClick={handleApprove}
              disabled={isPending}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<CancelRoundedIcon fontSize="small" />}
              onClick={handleReject}
              disabled={isPending}
            >
              Reject
            </Button>
          </>
        ) : (
          <Chip
            label={status}
            size="small"
            color={
              status === "executed"
                ? "success"
                : status === "rejected"
                  ? "error"
                  : "default"
            }
            sx={{ textTransform: "capitalize" }}
          />
        )}

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
            <Box sx={{ p: 2 }}>
              <Typography variant="body2">{rec.summary}</Typography>
            </Box>
          </FoldableSection>

          {rec.todos?.length > 0 && (
            <FoldableSection
              title="Action Items"
              titleColor="warning.main"
              borderColor="warning.main"
            >
              <Box sx={{ p: 2 }}>
                <List dense disablePadding>
                  {rec.todos.map((todo, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.2 }}>
                      <ListItemText
                        primary={`• ${todo}`}
                        slotProps={{ primary: { variant: "body2" } }}
                      />
                    </ListItem>
                  ))}
                </List>
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
            <Alert severity="info">Updating action status...</Alert>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
