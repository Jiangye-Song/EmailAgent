import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { RulesEditor } from "@/components/settings/RulesEditor";
import { CategoryPromptsEditor } from "@/components/settings/CategoryPromptsEditor";
import { ForwardingInfo } from "@/components/settings/ForwardingInfo";
import { SenderWhitelist } from "@/components/settings/SenderWhitelist";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { DEFAULT_CATEGORY_PROMPTS } from "@/lib/ai/category-prompts";
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

type WhitelistRow = {
  id: string;
  sender_email: string;
  sender_domain: string | null;
};

async function getSenderWhitelist(userId: string) {
  const { rows } = await pool.query<WhitelistRow>(
    `SELECT id, sender_email, sender_domain
     FROM sender_whitelist
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    senderEmail: row.sender_email,
    senderDomain: row.sender_domain,
  }));
}

async function getUserCategoryPrompts(
  userId: string,
): Promise<{ categoryKey: string; displayName: string; prompt: string }[]> {
  const { rows } = await pool.query<{
    category_key: string;
    display_name: string;
    prompt: string | null;
  }>(
    `SELECT uc.category_key, uc.display_name, ucp.prompt
     FROM user_categories uc
     LEFT JOIN user_category_prompts ucp
       ON ucp.user_id = uc.user_id
      AND ucp.category = uc.category_key
     WHERE uc.user_id = $1 AND uc.is_active = true
     ORDER BY uc.created_at ASC`,
    [userId],
  );

  return rows.map((row) => ({
    categoryKey: row.category_key,
    displayName: row.display_name,
    prompt:
      row.prompt ??
      DEFAULT_CATEGORY_PROMPTS[row.category_key] ??
      "Use neutral analysis and extract practical next steps.",
  }));
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [rules, forwardingAddress, whitelistEntries, categoryPrompts] = await Promise.all([
    getUserRules(session.user.id),
    ensureForwardingAddress(session.user.id),
    getSenderWhitelist(session.user.id),
    getUserCategoryPrompts(session.user.id),
  ]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
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
          bgcolor: "background.paper",
        }}
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
                    Sender whitelist
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Add the email address that is configured to auto-forward into your agent address. This whitelist checks the forwarding sender mailbox, not the original recipient in the email thread.
                  </Typography>
                </Box>
                <Divider />
                <SenderWhitelist initialEntries={whitelistEntries} />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    Category prompts
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Customize how AI should analyze each category after the first-stage classifier picks a category.
                  </Typography>
                </Box>
                <Divider />
                <CategoryPromptsEditor initialCategories={categoryPrompts} />
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
