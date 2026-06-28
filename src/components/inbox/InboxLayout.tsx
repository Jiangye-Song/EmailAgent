"use client";

import { useState } from "react";
import Link from "next/link";
import {
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
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  categoryCounts: Record<string, number>;
  forwardingAddress: string;
};

export function InboxLayout({ records, categoryCounts, forwardingAddress }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    selectedCategory === "all"
      ? records
      : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;
  const sideWidth = 220;
  const listWidth = 360;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, rgba(255,247,237,0.7) 0%, rgba(236,253,245,0.7) 100%)",
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
            Email Digest Inbox
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
            categoryCounts={categoryCounts}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedId(null);
              if (!isDesktop) setSidebarOpen(false);
            }}
          />
        </Drawer>

        <Box
          sx={{
            width: { xs: "100%", md: listWidth },
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
          }}
        >
          <EmailList records={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, bgcolor: "background.default" }}>
          <EmailDetail record={selectedRecord} forwardingAddress={forwardingAddress} />
        </Box>
      </Stack>
    </Box>
  );
}
