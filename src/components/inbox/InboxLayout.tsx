"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import {
  alpha,
  AppBar,
  Box,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailDetail } from "@/components/inbox/EmailDetail";
import { markEmailRead } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";
import type { PanelKey } from "@/components/PanelSwitcher";

const PANEL_TITLES: Record<PanelKey, string> = {
  inbox: "Smart Inbox",
  opportunities: "Opportunity Board",
  deals: "Valuable Deals",
  todo: "To Do List",
};

type Props = {
  activePanel?: PanelKey;
  panelContent?: ReactNode;
  records?: EmailRecord[];
  categoryCounts?: Record<string, number>;
  forwardingAddress?: string;
};

export function InboxLayout({
  activePanel = "inbox",
  panelContent,
  records = [],
  categoryCounts = {},
  forwardingAddress = "",
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    selectedCategory === "all"
      ? records
      : selectedCategory === "starred"
        ? records.filter((r) => r.is_starred)
        : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;
  const sideWidth = 220;
  const listWidth = 360;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: isDark
          ? "linear-gradient(140deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.9) 50%, rgba(17,24,39,0.88) 100%)"
          : "linear-gradient(135deg, rgba(255,247,237,0.75) 0%, rgba(236,253,245,0.75) 100%)",
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          backdropFilter: "blur(8px)",
          bgcolor: alpha(theme.palette.background.paper, isDark ? 0.85 : 0.75),
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setSidebarOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuRoundedIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {PANEL_TITLES[activePanel]}
          </Typography>
          <Tooltip title="Settings">
            <IconButton component={Link} href="/settings" color="inherit">
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>
          <ThemeModeToggle />
        </Toolbar>
      </AppBar>

      <Stack direction="row" sx={{ height: "calc(100vh - 65px)" }}>
        <Drawer
          variant={isDesktop ? "permanent" : "temporary"}
          open={isDesktop ? true : sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: sideWidth,
                borderRight: "1px solid",
                borderColor: "divider",
                position: isDesktop ? "relative" : "fixed",
                height: isDesktop ? "100%" : undefined,
              },
            },
          }}
        >
          <InboxSidebar
            activePanel={activePanel}
            categoryCounts={categoryCounts}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedId(null);
              if (!isDesktop) setSidebarOpen(false);
            }}
          />
        </Drawer>

        {activePanel === "inbox" ? (
          <>
            <Box
              sx={{
                width: { xs: "100%", md: listWidth },
                borderRight: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                overflow: "hidden",
              }}
            >
              <EmailList
                records={filtered}
                selectedId={selectedId}
                onSelect={(id) => {
                  const selected = records.find((r) => r.id === id);
                  setSelectedId(id);

                  if (selected && !selected.is_read) {
                    void markEmailRead(id);
                  }
                }}
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0, bgcolor: "background.default" }}>
              <EmailDetail record={selectedRecord} forwardingAddress={forwardingAddress} />
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0, overflow: "auto", bgcolor: "background.default" }}>
            {panelContent}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
