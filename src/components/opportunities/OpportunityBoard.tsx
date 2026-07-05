"use client";

import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import { AttentionPanel } from "./AttentionPanel";
import { OpportunityCard } from "./OpportunityCard";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import type {
  OpportunityBoard,
  OpportunityBoardItem,
} from "@/lib/opportunities/board-query";
import type { OpportunityStage } from "@/lib/opportunities/schemas";

const STAGE_LABELS: Record<OpportunityStage, string> = {
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

const STAGE_ORDER: OpportunityStage[] = [
  "applied",
  "assessment",
  "interview",
  "offer",
  "closed",
];

type Props = { board?: OpportunityBoard | null; onboardingCompleted?: boolean };

export function OpportunityBoardView({ board, onboardingCompleted = true }: Props) {
  if (!onboardingCompleted) {
    return <OnboardingForm />;
  }

  if (!board) return null;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
        {board.urgent.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <AttentionPanel items={board.urgent} />
          </Box>
        )}

        <Grid container spacing={2}>
          {STAGE_ORDER.map((stage) => (
            <Grid key={stage} size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mb: 1, alignItems: "center" }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {STAGE_LABELS[stage]}
                  </Typography>
                  <Chip
                    label={board.byStage[stage].length}
                    size="small"
                    color={
                      board.byStage[stage].length > 0 ? "primary" : "default"
                    }
                  />
                </Stack>
                <Stack spacing={1.5}>
                  {board.byStage[stage].length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: "italic", px: 1 }}
                    >
                      None
                    </Typography>
                  ) : (
                    board.byStage[stage].map((item: OpportunityBoardItem) => (
                      <OpportunityCard key={item.id} item={item} />
                    ))
                  )}
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
  );
}
