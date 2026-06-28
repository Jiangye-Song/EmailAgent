"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";

export default function RegisterPage() {
  const theme = useTheme();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        router.push("/login?registered=1");
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Registration failed. Please try again.");
      }
    });
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          theme.palette.mode === "dark"
            ? "radial-gradient(circle at 80% 15%, rgba(251,191,36,0.16) 0%, transparent 36%), radial-gradient(circle at 5% 80%, rgba(59,130,246,0.16) 0%, transparent 36%), linear-gradient(160deg, #020617 0%, #111827 100%)"
            : "radial-gradient(circle at 80% 15%, #fde68a 0%, transparent 36%), radial-gradient(circle at 5% 80%, #bfdbfe 0%, transparent 36%), linear-gradient(160deg, #eff6ff 0%, #fffbeb 100%)",
      }}
    >
      <Box sx={{ position: "fixed", top: 12, right: 12 }}>
        <ThemeModeToggle />
      </Box>
      <Container maxWidth="sm" disableGutters>
        <Card sx={{ p: { xs: 2, sm: 3 } }}>
          <CardContent>
            <Stack spacing={3}>
              <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "secondary.main",
                    color: "#111827",
                    boxShadow: "0 10px 24px rgba(251,146,60,0.35)",
                  }}
                >
                  <AutoAwesomeRoundedIcon fontSize="large" />
                </Box>
                <Typography variant="h4">Create an account</Typography>
                <Typography color="text.secondary">
                  Start your AI-powered email digest in seconds.
                </Typography>
              </Stack>

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <TextField
                    id="name"
                    name="name"
                    type="text"
                    label="Name"
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    fullWidth
                  />

                  <TextField
                    id="email"
                    name="email"
                    type="email"
                    label="Email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    fullWidth
                  />

                  <TextField
                    id="password"
                    name="password"
                    type="password"
                    label="Password"
                    required
                    slotProps={{ htmlInput: { minLength: 8 } }}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    fullWidth
                  />

                  <TextField
                    id="confirm"
                    name="confirm"
                    type="password"
                    label="Confirm password"
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    fullWidth
                  />

                  {error && <Alert severity="error">{error}</Alert>}

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isPending}
                    fullWidth
                    startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
                  >
                    {isPending ? "Creating account..." : "Create account"}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                Already have an account?{" "}
                <MuiLink component={Link} href="/login" underline="hover" color="primary.main">
                  Sign in
                </MuiLink>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
