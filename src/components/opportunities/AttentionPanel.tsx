"use client";

import { Alert, Box, Chip, Stack, Typography } from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { OpportunityBoardItem } from "@/lib/opportunities/board-query";

type Props = { items: OpportunityBoardItem[] };

export function AttentionPanel({ items }: Props) {
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", mb: 1 }}
      >
        <WarningAmberRoundedIcon color="warning" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Needs Attention
        </Typography>
        <Chip label={items.length} color="warning" size="small" />
      </Stack>
      <Stack spacing={1}>
        {items.map((item) => (
          <Alert key={item.id} severity="warning" icon={false} sx={{ py: 0.5 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.company} — {item.role}
                </Typography>
                {item.nextAction && (
                  <Typography variant="caption" color="text.secondary">
                    {item.nextAction}
                  </Typography>
                )}
              </Box>
              {item.nextDeadline && (
                <Chip
                  label={new Date(item.nextDeadline).toLocaleDateString()}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
          </Alert>
        ))}
      </Stack>
    </Box>
  );
}
