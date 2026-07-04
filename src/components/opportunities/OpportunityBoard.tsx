"use client";

import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  AppBar,
  Toolbar,
  Button,
  Chip,
} from "@mui/material";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import Link from "next/link";
import { AttentionPanel } from "./AttentionPanel";
import { OpportunityCard } from "./OpportunityCard";
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

type Props = { board: OpportunityBoard };

export function OpportunityBoardView({ board }: Props) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <WorkRoundedIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Opportunity Board
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              href="/opportunities"
              variant="text"
              size="small"
            >
              Board
            </Button>
            <Button
              component={Link}
              href="/inbox"
              variant="text"
              size="small"
            >
              All Emails
            </Button>
            <Button
              component={Link}
              href="/deals"
              variant="text"
              size="small"
            >
              Deals
            </Button>
            <Button
              component={Link}
              href="/settings"
              variant="text"
              size="small"
            >
              Settings
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

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
    </Box>
  );
}
