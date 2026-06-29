"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import { toggleStarEmail } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";

const CATEGORY_COLORS: Record<string, "error" | "primary" | "secondary" | "warning" | "default"> = {
  alert: "error",
  personal: "primary",
  newsletter: "secondary",
  promotion: "warning",
  other: "default",
};

type Props = {
  records: EmailRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function EmailList({ records, selectedId, onSelect }: Props) {
  if (records.length === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          px: 2,
          textAlign: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No emails in this category.
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding sx={{ overflowY: "auto", height: "100%", bgcolor: "background.paper" }}>
      {records.map((record) => {
        const isSelected = record.id === selectedId;
        const relativeTime = record.received_at
          ? formatDistanceToNow(new Date(record.received_at), { addSuffix: true })
          : "";

        return (
          <ListItem key={record.id} disablePadding divider>
            <ListItemButton
              selected={isSelected}
              onClick={() => onSelect(record.id)}
              sx={{
                alignItems: "flex-start",
                py: 1.5,
                px: 2,
                color: "text.primary",
              }}
            >
              <Stack spacing={0.6} sx={{ width: "100%", minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                  <Typography
                    variant="caption"
                    color="text.primary"
                    sx={{
                      fontWeight: record.is_read ? 600 : 800,
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                    noWrap
                  >
                    {!record.is_read && (
                      <FiberManualRecordRoundedIcon
                        sx={{ fontSize: 8, color: "primary.main", flexShrink: 0 }}
                      />
                    )}
                    {record.sender.split("<")[0].trim() || record.sender}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {relativeTime}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  noWrap
                  color="text.primary"
                  sx={{ fontWeight: record.is_read ? 400 : 700 }}
                >
                  {record.subject}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Chip
                    label={record.category}
                    color={CATEGORY_COLORS[record.category]}
                    size="small"
                    sx={{
                      alignSelf: "flex-start",
                      height: 20,
                      fontSize: 11,
                      textTransform: "capitalize",
                      fontWeight: 600,
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleStarEmail(record.id);
                    }}
                    sx={{ color: record.is_starred ? "warning.main" : "text.disabled" }}
                  >
                    {record.is_starred ? (
                      <StarRoundedIcon fontSize="small" />
                    ) : (
                      <StarBorderRoundedIcon fontSize="small" />
                    )}
                  </IconButton>
                </Stack>
              </Stack>
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
