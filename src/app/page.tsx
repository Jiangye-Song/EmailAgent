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
                <Box sx={{ px: 1.5, py: 1.15, bgcolor: isDark ? "#172033" : "#f1eee6", borderBottom: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Stack direction="row" spacing={0.6} sx={{ flex: 1, alignItems: "center" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 750, whiteSpace: "nowrap" }}>Email Digest Inbox</Typography>
                    </Stack>
                    <Box sx={{ display: { xs: "none", sm: "block" }, flex: 1, maxWidth: 260, border: "1px solid", borderColor: "text.disabled", borderRadius: 999, px: 1.25, py: 0.65 }}><Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}><SearchRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} /><Typography variant="caption" color="text.secondary" noWrap>Search emails semantically</Typography></Stack></Box>
                    <IconButton size="small" aria-label="Inbox settings"><TuneRoundedIcon fontSize="small" /></IconButton>
                  </Stack>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "78px 0.95fr 1.3fr" }, minHeight: 410 }}>
                  <Box sx={{ display: { xs: "none", sm: "block" }, borderRight: "1px solid", borderColor: "divider", bgcolor: isDark ? "#111827" : "#fbfaf6", p: 1 }}>
                    <Stack spacing={1.25} sx={{ alignItems: "center" }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText", mb: 0.75 }}><EmailRoundedIcon sx={{ fontSize: 18 }} /></Box>
                      {["All", "Starred", "Work", "Focus", "Alerts", "Other"].map((label, index) => <Stack key={label} spacing={0.35} sx={{ width: "100%", alignItems: "center", color: index === 0 ? "primary.main" : "text.secondary", py: 0.45, borderRadius: 1, bgcolor: index === 0 ? alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1) : "transparent" }}><Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: index === 0 ? "primary.main" : "text.disabled" }} /><Typography variant="caption" sx={{ fontSize: 9, fontWeight: index === 0 ? 700 : 500 }}>{label}</Typography></Stack>)}
                    </Stack>
                  </Box>
                  <Box sx={{ borderRight: { sm: "1px solid" }, borderColor: "divider", minWidth: 0 }}>
                    <Stack direction="row" sx={{ px: 1.5, py: 1.25, justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>All mail</Typography>
                      <Chip label="3" size="small" color="primary" variant="outlined" />
                    </Stack>
                    {sampleEmails.map((email) => <PreviewEmail key={email.subject} {...email} />)}
                    <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="caption" color="text.secondary" noWrap>"Planning notes"</Typography><Typography variant="body2" noWrap sx={{ fontWeight: 600, mt: 0.35 }}>A few ideas for next month</Typography><Chip label="Personal" size="small" sx={{ mt: 0.8, fontSize: 10 }} /></Box>
                  </Box>
                  <Box sx={{ display: { xs: "none", sm: "block" }, bgcolor: "background.default", minWidth: 0 }}>
                    <Box sx={{ px: 2, py: 1.45, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="h6" noWrap sx={{ fontSize: 15, fontWeight: 750 }}>Your interview availability</Typography><Typography variant="caption" color="text.secondary" noWrap>From: Maya Chen &nbsp; Today, 9:42 AM</Typography></Box>
                    <Stack direction="row" spacing={0.75} sx={{ px: 1.5, py: 1.1, borderBottom: "1px solid", borderColor: "divider" }}><Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, fontSize: 10 }}>Star</Button><Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, fontSize: 10 }}>Reply</Button></Stack>
                    <Stack spacing={1.3} sx={{ p: 1.5 }}>
                      <Box sx={{ border: "1px solid", borderLeft: "3px solid", borderColor: "divider", borderLeftColor: "primary.main", bgcolor: "background.paper" }}><Box sx={{ px: 1.25, py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="caption" sx={{ fontWeight: 750, color: "primary.main", letterSpacing: "0.06em" }}>SUMMARY</Typography></Box><Typography variant="body2" sx={{ p: 1.25, lineHeight: 1.5 }}>The recruiting team is asking you to choose a time for the next interview by Friday.</Typography></Box>
                      <Box sx={{ border: "1px solid", borderLeft: "3px solid", borderColor: "divider", borderLeftColor: "secondary.main", bgcolor: "background.paper" }}><Box sx={{ px: 1.25, py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="caption" sx={{ fontWeight: 750, color: "secondary.main", letterSpacing: "0.06em" }}>ACTION ITEMS</Typography></Box><Stack spacing={0.8} sx={{ p: 1.25 }}><Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}><CheckCircleRoundedIcon sx={{ color: "primary.main", fontSize: 15 }} /><Typography variant="caption">Choose an interview time</Typography></Stack><Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}><CheckCircleRoundedIcon sx={{ color: "primary.main", fontSize: 15 }} /><Typography variant="caption">Reply before Friday</Typography></Stack><Button variant="contained" size="small" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 0.4, fontSize: 10 }}>Approve action</Button></Stack></Box>
                      <Box sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper", px: 1.25, py: 1 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>ORIGINAL EMAIL</Typography></Box>
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
