"use client";

import {
  Avatar,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";

type CategoryItem = {
  key: string;
  label: string;
  icon: typeof MailRoundedIcon;
};

const CORE_CATEGORIES: CategoryItem[] = [
  { key: "all", label: "All", icon: MailRoundedIcon },
  { key: "starred", label: "Starred", icon: StarRoundedIcon },
];

const ICON_BY_CATEGORY: Record<string, typeof MailRoundedIcon> = {
  alert: NotificationsActiveRoundedIcon,
  work: WorkRoundedIcon,
  jobseeking: ManageSearchRoundedIcon,
  personal: PersonRoundedIcon,
  newsletter: SellRoundedIcon,
  promotion: CampaignRoundedIcon,
  other: ArchiveRoundedIcon,
};

type Props = {
  categoryCounts: Record<string, number>;
  categories: { categoryKey: string; displayName: string }[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
};

export function InboxSidebar({ categoryCounts, categories, selectedCategory, onSelectCategory }: Props) {
  const items: CategoryItem[] = [
    ...CORE_CATEGORIES,
    ...categories.map((category) => ({
      key: category.categoryKey,
      label: category.displayName,
      icon: ICON_BY_CATEGORY[category.categoryKey] ?? CategoryRoundedIcon,
    })),
  ];

  return (
    <Stack sx={{ height: "100%", bgcolor: "background.paper" }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", px: 2, py: 2 }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main" }}>
          <MailRoundedIcon sx={{ fontSize: 18 }} />
        </Avatar>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Smart Inbox
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Fast triage
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <List dense sx={{ flex: 1, py: 1 }}>
        {items.map(({ key, label, icon: Icon }) => {
          const count = categoryCounts[key] ?? 0;
          const isSelected = selectedCategory === key;
          return (
            <ListItem key={key} disablePadding sx={{ px: 1 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => onSelectCategory(key)}
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
    </Stack>
  );
}
