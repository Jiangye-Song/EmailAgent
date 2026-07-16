"use client";

import Link from "next/link";
import {
  alpha,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";

const sampleEmails = [
  {
    sender: "Maya Chen",
    subject: "Your interview availability",
    preview: "We would love to schedule the next conversation...",
    tag: "Career",
    color: "#0f766e",
    unread: true,
  },
  {
    sender: "Northstar Studio",
    subject: "Project kickoff - Tuesday",
    preview: "Here is the calendar invite and a few notes...",
    tag: "Calendar",
    color: "#ea580c",
    unread: true,
  },
  {
    sender: "Your monthly statement",
    subject: "February statement is ready",
    preview: "Your latest statement is now available to view...",
    tag: "Finance",
    color: "#7c3aed",
    unread: false,
  },
];

function PreviewEmail({
  sender,
  subject,
  preview,
  tag,
  color,
  unread,
}: (typeof sampleEmails)[number]) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "34px minmax(0, 1fr) auto",
        gap: 1.25,
        alignItems: "center",
        px: 1.5,
        py: 1.35,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: unread ? "action.hover" : "transparent",
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(color, 0.13),
          color,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {sender.charAt(0)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.25 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: unread ? 700 : 500 }}>
            {sender}
          </Typography>
          {unread && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main" }} />}
        </Stack>
        <Typography variant="body2" noWrap sx={{ fontWeight: unread ? 650 : 500 }}>
          {subject}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {preview}
        </Typography>
      </Box>
      <Chip label={tag} size="small" sx={{ display: { xs: "none", sm: "inline-flex" }, fontSize: 11 }} />
    </Box>
  );
}

export default function Home() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <Box component="header" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Stack direction="row" sx={{ minHeight: 72, alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: "primary.main", color: "primary.contrastText", display: "grid", placeItems: "center" }}>
                <MarkEmailUnreadRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 750, letterSpacing: "-0.02em" }}>
                EmailAgent
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Button component="a" href="#how-it-works" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                How it works
              </Button>
              <ThemeModeToggle />
              <Button component={Link} href="/login" variant="outlined" size="small">
                Sign in
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        <Box component="section" sx={{ pt: { xs: 7, md: 11 }, pb: { xs: 8, md: 12 } }}>
          <Container maxWidth="lg">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.88fr 1.12fr" }, gap: { xs: 6, md: 9 }, alignItems: "center" }}>
              <Stack spacing={3}>
                <Chip icon={<AutoAwesomeRoundedIcon />} label="A calmer way to process email" color="primary" variant="outlined" sx={{ alignSelf: "flex-start", fontWeight: 600 }} />
                <Typography component="h1" variant="h1" sx={{ maxWidth: 620, fontSize: { xs: "3.1rem", sm: "4.2rem", md: "5.25rem" }, lineHeight: 0.98 }}>
                  Start with what matters.
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 520, fontWeight: 400, lineHeight: 1.55 }}>
                  EmailAgent turns forwarded emails into a short, prioritized list of decisions, summaries, and next steps. AI handles the first pass. You stay in control.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
                  <Button component={Link} href="/register" variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ px: 2.5, py: 1.4 }}>
                    Create your inbox
                  </Button>
                  <Button component={Link} href="/login" variant="text" size="large" sx={{ px: 2.5, py: 1.4 }}>
                    I already have an account
                  </Button>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center", color: "text.secondary", pt: 0.5 }}>
                  <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}><CheckCircleRoundedIcon sx={{ fontSize: 17, color: "primary.main" }} /><Typography variant="body2">Human approval built in</Typography></Stack>
                  <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", display: { xs: "none", sm: "flex" } }}><CheckCircleRoundedIcon sx={{ fontSize: 17, color: "primary.main" }} /><Typography variant="body2">Works with any provider</Typography></Stack>
                </Stack>
              </Stack>

              <Paper elevation={0} sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", boxShadow: isDark ? "0 24px 70px rgba(0,0,0,0.3)" : "0 24px 70px rgba(15,23,42,0.14)" }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: isDark ? "#172033" : "#f1eee6", borderBottom: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Stack direction="row" spacing={0.6} sx={{ flex: 1, alignItems: "center" }}>
                      <EmailRoundedIcon sx={{ color: "primary.main", fontSize: 19 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>Your inbox</Typography>
                    </Stack>
                    <Tooltip title="Semantic search"><IconButton size="small" aria-label="Search emails"><SearchRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Inbox settings"><IconButton size="small" aria-label="Inbox settings"><TuneRoundedIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "0.9fr 1.1fr" }, minHeight: 370 }}>
                  <Box sx={{ borderRight: { sm: "1px solid" }, borderColor: "divider" }}>
                    <Stack direction="row" sx={{ px: 1.5, py: 1.25, justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Today</Typography>
                      <Chip label="2 new" size="small" color="primary" variant="outlined" />
                    </Stack>
                    {sampleEmails.map((email) => <PreviewEmail key={email.subject} {...email} />)}
                  </Box>
                  <Box sx={{ display: { xs: "none", sm: "block" }, p: 2.25, bgcolor: "background.default" }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: alpha("#0f766e", 0.14), color: "primary.main", display: "grid", placeItems: "center", fontWeight: 700 }}>M</Box>
                        <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>Maya Chen</Typography><Typography variant="caption" color="text.secondary">Today, 9:42 AM</Typography></Box>
                      </Stack>
                      <Typography variant="h6" sx={{ fontWeight: 750 }}>Your interview availability</Typography>
                      <Box sx={{ p: 1.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.07) }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}><AutoAwesomeRoundedIcon sx={{ color: "primary.main", fontSize: 18, mt: 0.2 }} /><Box><Typography variant="caption" sx={{ color: "primary.main", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI summary</Typography><Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.5 }}>The recruiting team is asking you to choose a time for the next interview by Friday.</Typography></Box></Stack>
                      </Box>
                      <Stack spacing={1}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Suggested next steps</Typography><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><CheckCircleRoundedIcon sx={{ color: "primary.main", fontSize: 18 }} /><Typography variant="body2">Choose an interview time</Typography></Stack><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><CheckCircleRoundedIcon sx={{ color: "primary.main", fontSize: 18 }} /><Typography variant="body2">Reply before Friday</Typography></Stack></Stack>
                      <Button variant="contained" size="small" endIcon={<ArrowForwardRoundedIcon />}>Review action</Button>
                    </Stack>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Container>
        </Box>

        <Box component="section" id="how-it-works" sx={{ py: { xs: 8, md: 11 }, bgcolor: isDark ? "#111a2a" : "#eeece4", borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
          <Container maxWidth="lg">
            <Stack spacing={1} sx={{ mb: 5, maxWidth: 620 }}><Typography variant="overline" sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.14em" }}>A better first pass</Typography><Typography variant="h2" sx={{ fontSize: { xs: "2.3rem", md: "3.2rem" } }}>Less inbox management. More forward motion.</Typography><Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>Forward a message to your personal address and EmailAgent gives you the context to decide what happens next.</Typography></Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {[
                { icon: <EmailRoundedIcon />, title: "Forward once", copy: "Send email from any provider to your personal EmailAgent address." },
                { icon: <AutoAwesomeRoundedIcon />, title: "Understand faster", copy: "Get a clear summary, category, priority, and extracted action items." },
                { icon: <CheckCircleRoundedIcon />, title: "Decide with confidence", copy: "Approve, reject, reply, or add to your calendar when you are ready." },
              ].map((item, index) => <Box key={item.title} sx={{ p: 2.5, borderTop: "2px solid", borderColor: index === 0 ? "primary.main" : index === 1 ? "secondary.main" : "#7c3aed" }}><Box sx={{ color: index === 0 ? "primary.main" : index === 1 ? "secondary.main" : "#7c3aed", mb: 2 }}>{item.icon}</Box><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>{item.title}</Typography><Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>{item.copy}</Typography></Box>)}
            </Box>
          </Container>
        </Box>

        <Box component="section" sx={{ py: { xs: 7, md: 9 } }}>
          <Container maxWidth="lg">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.3fr 0.7fr" }, gap: 5, alignItems: "center" }}>
              <Stack spacing={2}><Typography variant="h3" sx={{ maxWidth: 650, fontSize: { xs: "2rem", md: "2.7rem" } }}>Built for the moment you almost miss something important.</Typography><Typography color="text.secondary" sx={{ maxWidth: 610, lineHeight: 1.7 }}>EmailAgent was born from email avoidance and missed opportunities. It is designed to make the first step small: see what matters, understand why, and choose the next move.</Typography></Stack>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><NotificationsActiveRoundedIcon color="primary" /><Typography variant="body2">Push notifications when something needs you</Typography></Stack>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><CalendarMonthRoundedIcon color="secondary" /><Typography variant="body2">One-click calendar exports for detected events</Typography></Stack>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><CheckCircleRoundedIcon sx={{ color: "#7c3aed" }} /><Typography variant="body2">Human approval before consequential actions</Typography></Stack>
              </Stack>
            </Box>
          </Container>
        </Box>
      </Box>

      <Box component="footer" sx={{ py: 3, borderTop: "1px solid", borderColor: "divider" }}><Container maxWidth="lg"><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}><Typography variant="body2" color="text.secondary">EmailAgent</Typography><Typography variant="caption" color="text.secondary">A clearer way through email.</Typography></Stack></Container></Box>
    </Box>
  );
}
