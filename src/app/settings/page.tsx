import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { RulesEditor } from "@/components/settings/RulesEditor";
import { ForwardingInfo } from "@/components/settings/ForwardingInfo";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import Link from "next/link";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

async function getUserRules(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ rule_text: string }>(
    `SELECT rule_text FROM user_rules WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return rows.map((r) => r.rule_text);
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [rules, forwardingAddress] = await Promise.all([
    getUserRules(session.user.id),
    ensureForwardingAddress(session.user.id),
  ]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(145deg, rgba(255,247,237,0.7) 0%, rgba(239,246,255,0.6) 100%)",
      }}
    >
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: "1px solid", borderColor: "divider", backdropFilter: "blur(8px)" }}
      >
        <Toolbar>
          <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", flexGrow: 1 }}>
            <SettingsRoundedIcon color="primary" />
            <Typography variant="h6">Settings</Typography>
          </Stack>
          <Link href="/inbox" style={{ textDecoration: "none" }}>
            <Button startIcon={<ArrowBackRoundedIcon />}>Back to inbox</Button>
          </Link>
          <ThemeModeToggle />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    Your forwarding address
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Add this address to auto-forward rules in your email app. Every forwarded message is processed by AI and appears in your inbox.
                  </Typography>
                </Box>
                <Divider />
                <ForwardingInfo address={forwardingAddress} />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    AI rules
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Write plain-language rules to guide classification and actions. Rules are applied during processing.
                  </Typography>
                </Box>
                <Divider />
                <RulesEditor initialRules={rules} />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
