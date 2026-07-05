"use client";

import { type ElementType, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Box,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";

export type PanelKey = "inbox" | "opportunities" | "deals" | "todo";

type PanelDef = {
  key: PanelKey;
  label: string;
  sub: string;
  icon: ElementType;
  href: string;
  color: string;
  disabled?: boolean;
};

const PANELS: PanelDef[] = [
  {
    key: "inbox",
    label: "Smart Inbox",
    sub: "Fast triage",
    icon: MailRoundedIcon,
    href: "/inbox",
    color: "primary.main",
  },
  {
    key: "opportunities",
    label: "Opportunity Board",
    sub: "Job tracking",
    icon: WorkRoundedIcon,
    href: "/opportunities",
    color: "success.main",
  },
  {
    key: "deals",
    label: "Valuable Deals",
    sub: "Offers & discounts",
    icon: LocalOfferRoundedIcon,
    href: "/deals",
    color: "warning.main",
  },
  {
    key: "todo",
    label: "To Do List",
    sub: "Coming soon",
    icon: ChecklistRoundedIcon,
    href: "/todo",
    color: "text.secondary",
    disabled: true,
  },
];

type Props = { activePanel: PanelKey };

export function PanelSwitcher({ activePanel }: Props) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const current = PANELS.find((p) => p.key === activePanel) ?? PANELS[0];
  const CurrentIcon = current.icon;

  return (
    <>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          px: 1.5,
          py: 1.5,
          mx: 1,
          my: 0.5,
          borderRadius: 2,
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover" },
          "&:active": { bgcolor: "action.selected" },
        }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={Boolean(anchorEl)}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: current.color, flexShrink: 0 }}>
          <CurrentIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
            {current.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
            {current.sub}
          </Typography>
        </Box>
        <ExpandMoreRoundedIcon
          sx={{
            fontSize: 16,
            color: "text.secondary",
            transition: "transform 0.15s",
            transform: Boolean(anchorEl) ? "rotate(180deg)" : "none",
            flexShrink: 0,
          }}
        />
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: 244, mt: 0.5 } } }}
        transformOrigin={{ horizontal: "left", vertical: "top" }}
        anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
      >
        {PANELS.map((panel) => {
          const PanelIcon = panel.icon;
          const isActive = panel.key === activePanel;
          return (
            <MenuItem
              key={panel.key}
              selected={isActive}
              disabled={panel.disabled}
              onClick={() => {
                setAnchorEl(null);
                if (!panel.disabled) router.push(panel.href);
              }}
              sx={{ borderRadius: 1.5, mx: 0.5, my: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Avatar
                  sx={{
                    width: 26,
                    height: 26,
                    bgcolor: panel.disabled
                      ? "action.disabledBackground"
                      : panel.color,
                  }}
                >
                  <PanelIcon sx={{ fontSize: 14 }} />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={panel.label}
                secondary={panel.sub}
                slotProps={{
                  primary: {
                    sx: { fontSize: 13, fontWeight: isActive ? 700 : 500 },
                  },
                  secondary: { sx: { fontSize: 11 } },
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
