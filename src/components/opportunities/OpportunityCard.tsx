"use client";

import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { OpportunityBoardItem } from "@/lib/opportunities/board-query";

function confidenceLabel(confidence: number): {
  label: string;
  color: "success" | "warning" | "error" | "default";
} {
  if (confidence >= 0.85) return { label: "High", color: "success" };
  if (confidence >= 0.6) return { label: "Medium", color: "warning" };
  return { label: "Low", color: "error" };
}

function formatDeadline(deadline: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < 0) return "Overdue";
  if (diffHours < 24) return `${Math.round(diffHours)}h left`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d left`;
}

type Props = { item: OpportunityBoardItem };

export function OpportunityCard({ item }: Props) {
  const { label: confLabel, color: confColor } = confidenceLabel(item.confidence);
  const deadlineText = formatDeadline(item.nextDeadline);

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {item.company}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {item.role}
        </Typography>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}
        >
          <Chip label={confLabel} color={confColor} size="small" />
          {item.outcome !== "active" && (
            <Chip label={item.outcome} size="small" variant="outlined" />
          )}
        </Stack>

        {deadlineText && (
          <Typography
            variant="caption"
            color={deadlineText === "Overdue" ? "error" : "warning.main"}
            sx={{ display: "block", mt: 0.5, fontWeight: 600 }}
          >
            {deadlineText}
          </Typography>
        )}

        {item.nextAction && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            → {item.nextAction}
          </Typography>
        )}

        {item.evidence.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ fontStyle: "italic" }}
            >
              &quot;{item.evidence[0].slice(0, 80)}
              {item.evidence[0].length > 80 ? "…" : ""}&quot;
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
