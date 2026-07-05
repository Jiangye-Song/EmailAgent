"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";

type Deal = {
  id: string;
  brand: string;
  offer_type: string;
  offer_value: string | null;
  expires_at: string | null;
  matched_rule: string;
  relevance_reason: string;
  created_at: string;
};

type Props = { deals: Deal[] };

export function DealList({ deals }: Props) {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
        {deals.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <LocalOfferRoundedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No valuable deals yet
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Forward promotional emails and we&apos;ll surface the ones that match your preferences.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {deals.map((deal) => {
              const isExpired =
                deal.expires_at && new Date(deal.expires_at) < new Date();
              return (
                <Card key={deal.id} variant="outlined" sx={{ opacity: isExpired ? 0.6 : 1 }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
                        {deal.brand}
                      </Typography>
                      <Chip label={deal.offer_type.replace("_", " ")} size="small" />
                      {isExpired && <Chip label="Expired" color="error" size="small" />}
                    </Stack>
                    {deal.offer_value && (
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {deal.offer_value}
                      </Typography>
                    )}
                    {deal.expires_at && !isExpired && (
                      <Typography variant="caption" color="warning.main">
                        Expires {new Date(deal.expires_at).toLocaleDateString()}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, fontStyle: "italic" }}>
                      {deal.relevance_reason}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Container>
  );
}
