"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
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
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";

export default function LoginPage() {
  const theme = useTheme();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
      } else {
        router.push("/inbox");
        router.refresh();
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
            ? "radial-gradient(circle at 20% 20%, rgba(45,212,191,0.18) 0%, transparent 40%), radial-gradient(circle at 80% 0%, rgba(251,146,60,0.18) 0%, transparent 35%), linear-gradient(135deg, #020617 0%, #0f172a 100%)"
            : "radial-gradient(circle at 20% 20%, #d1fae5 0%, transparent 40%), radial-gradient(circle at 80% 0%, #fed7aa 0%, transparent 35%), linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)",
      }}
    >
      <Box sx={{ position: "fixed", top: 12, right: 12 }}>
        <ThemeModeToggle />
      </Box>
      <Container maxWidth="sm" disableGutters>
        <Card sx={{ p: { xs: 2, sm: 3 }, backdropFilter: "blur(8px)" }}>
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
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    boxShadow: "0 10px 24px rgba(15,118,110,0.35)",
                  }}
                >
                  <MarkEmailUnreadRoundedIcon fontSize="large" />
                </Box>
                <Typography variant="h4">Welcome back</Typography>
                <Typography color="text.secondary">
                  Sign in to your Email Digest Agent account.
                </Typography>
              </Stack>

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
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
                    autoComplete="current-password"
                    placeholder="********"
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
                    {isPending ? "Signing in..." : "Sign in"}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                Don&apos;t have an account?{" "}
                <MuiLink component={Link} href="/register" underline="hover" color="primary.main">
                  Sign up
                </MuiLink>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
