"use client";

import {
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
} from "@mui/material";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { PanelSwitcher, type PanelKey } from "@/components/PanelSwitcher";

const CATEGORIES = [
  { key: "all", label: "All", icon: MailRoundedIcon },
  { key: "starred", label: "Starred", icon: StarRoundedIcon },
  { key: "alert", label: "Alerts", icon: NotificationsActiveRoundedIcon },
  { key: "personal", label: "Personal", icon: PersonRoundedIcon },
  { key: "newsletter", label: "Newsletter", icon: SellRoundedIcon },
  { key: "promotion", label: "Promotions", icon: CampaignRoundedIcon },
  { key: "other", label: "Other", icon: ArchiveRoundedIcon },
] as const;

type Props = {
  activePanel?: PanelKey;
  categoryCounts?: Record<string, number>;
  selectedCategory?: string;
  onSelectCategory?: (cat: string) => void;
};

export function InboxSidebar({
  activePanel = "inbox",
  categoryCounts = {},
  selectedCategory = "all",
  onSelectCategory,
}: Props) {
  return (
    <Stack sx={{ height: "100%", bgcolor: "background.paper" }}>
      <PanelSwitcher activePanel={activePanel} />
      <Divider />
      {activePanel === "inbox" && (
        <List dense sx={{ flex: 1, py: 1 }}>
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const count = categoryCounts[key] ?? 0;
            const isSelected = selectedCategory === key;
            return (
              <ListItem key={key} disablePadding sx={{ px: 1 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => onSelectCategory?.(key)}
                  sx={{ borderRadius: 2.5, py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    slotProps={{ primary: { sx: { fontSize: 13, fontWeight: isSelected ? 700 : 500 } } }}
                  />
                  {count > 0 && (
                    <Chip
                      size="small"
                      color={isSelected ? "primary" : "default"}
                      label={count}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Stack>
  );
}
