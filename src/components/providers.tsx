"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  alpha,
  type PaletteMode,
  createTheme,
  CssBaseline,
  responsiveFontSizes,
  ThemeProvider,
} from "@mui/material";
import { SessionProvider } from "next-auth/react";

const STORAGE_KEY = "email-agent-theme-mode";

type ThemeModeContextValue = {
  mode: PaletteMode;
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function buildTheme(mode: PaletteMode) {
  const baseTheme = createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#2dd4bf" : "#0f766e",
      },
      secondary: {
        main: mode === "dark" ? "#fb923c" : "#ea580c",
      },
      background: {
        default: mode === "dark" ? "#0b1220" : "#f7f5ef",
        paper: mode === "dark" ? "#111827" : "#fffdf8",
      },
    },
    typography: {
      fontFamily: "var(--font-geist-sans), sans-serif",
      h1: { fontWeight: 700, letterSpacing: "-0.02em" },
      h2: { fontWeight: 700, letterSpacing: "-0.015em" },
      h3: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: {
      borderRadius: 14,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            border: "1px solid",
            borderColor: alpha(mode === "dark" ? "#f8fafc" : "#1f2937", mode === "dark" ? 0.16 : 0.08),
            boxShadow:
              mode === "dark"
                ? "0 12px 36px rgba(2, 6, 23, 0.45)"
                : "0 12px 36px rgba(15, 23, 42, 0.08)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: {
            borderRadius: 14,
          },
        },
      },
    },
  });

  return responsiveFontSizes(baseTheme);
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within Providers");
  }
  return context;
}

export function Providers({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
    }),
    [mode],
  );

  return (
    <SessionProvider>
      <ThemeModeContext.Provider value={value}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </SessionProvider>
  );
}
