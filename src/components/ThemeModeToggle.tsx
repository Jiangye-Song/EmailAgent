"use client";

import { IconButton, Tooltip } from "@mui/material";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useThemeMode } from "@/components/providers";

export function ThemeModeToggle() {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton color="inherit" onClick={toggleMode} aria-label="Toggle theme mode">
        {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}
