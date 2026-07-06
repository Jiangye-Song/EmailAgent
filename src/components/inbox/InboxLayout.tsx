"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  alpha,
  AppBar,
  Box,
  Drawer,
  IconButton,
  InputAdornment,
  TextField,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailDetail } from "@/components/inbox/EmailDetail";
import { markEmailRead } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  searchQuery: string;
  categoryCounts: Record<string, number>;
  userCategories: { categoryKey: string; displayName: string }[];
  forwardingAddress: string;
};

export function InboxLayout({
  records,
  searchQuery,
  categoryCounts,
  userCategories,
  forwardingAddress,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isDark = theme.palette.mode === "dark";
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedId && !records.some((record) => record.id === selectedId)) {
      setSelectedId(null);
    }
  }, [records, selectedId]);

  const filtered =
    selectedCategory === "all"
      ? records
      : selectedCategory === "starred"
        ? records.filter((r) => r.is_starred)
        : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;
  const sideWidth = 220;
  const listWidth = 360;

  function submitSearch() {
    const nextQuery = searchInput.trim();
    const params = new URLSearchParams();

    if (nextQuery) {
      params.set("q", nextQuery);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    });
    setSelectedId(null);
  }

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
        <Toolbar sx={{ gap: 1.5, flexWrap: "wrap", py: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", minWidth: 0, flex: { xs: "1 1 100%", md: "0 0 auto" } }}
          >
            {!isDesktop && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setSidebarOpen(true)}
                sx={{ mr: 0.5 }}
              >
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              Email Digest Inbox
            </Typography>
          </Stack>

          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
            sx={{
              flex: { xs: "1 1 100%", md: 1 },
              minWidth: { xs: "100%", md: 320 },
              order: { xs: 3, md: 0 },
            }}
          >
            <TextField
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search emails semantically"
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchInput ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearchInput("");
                          router.replace(pathname, { scroll: false });
                          setSelectedId(null);
                        }}
                      >
                        <ClearRoundedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
              sx={{
                maxWidth: { md: 520 },
                ml: { md: 2 },
                "& .MuiInputBase-root": {
                  borderRadius: 999,
                  bgcolor: alpha(theme.palette.background.paper, isDark ? 0.5 : 0.9),
                },
              }}
            />
          </Box>

          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", ml: { md: "auto" } }}>
            <Tooltip title="Settings">
              <IconButton component={Link} href="/settings" color="inherit">
                <SettingsRoundedIcon />
              </IconButton>
            </Tooltip>
            <ThemeModeToggle />
          </Stack>
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
            categories={userCategories}
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
            display: { xs: selectedId ? "none" : "block", md: "block" },
          }}
        >
          <EmailList
            records={filtered}
            selectedId={selectedId}
            emptyMessage={
              searchQuery
                ? `No emails matched "${searchQuery}".`
                : selectedCategory === "all"
                  ? "No emails in your inbox yet."
                  : `No emails in ${selectedCategory}.`
            }
            onSelect={(id) => {
              const selected = records.find((r) => r.id === id);
              setSelectedId(id);

              if (selected && !selected.is_read) {
                void markEmailRead(id);
              }
            }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, bgcolor: "background.default", display: { xs: selectedId ? "block" : "none", md: "block" } }}>
          <EmailDetail record={selectedRecord} forwardingAddress={forwardingAddress} onBack={() => setSelectedId(null)} />
        </Box>
      </Stack>
    </Box>
  );
}
