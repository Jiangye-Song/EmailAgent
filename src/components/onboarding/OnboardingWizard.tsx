"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { completeOnboarding, type UseCaseId } from "@/lib/actions/onboarding-actions";
import { subscribeToWebPush } from "@/lib/push/subscribe";

const USE_CASES: {
  id: UseCaseId;
  label: string;
  Icon: React.ElementType;
  followUpQuestion: string | null;
  followUpPlaceholder?: string;
}[] = [
  {
    id: "work",
    label: "Professional & Business Communication",
    Icon: WorkRoundedIcon,
    followUpQuestion: "What's your current position?",
    followUpPlaceholder: "e.g. Senior Software Engineer",
  },
  {
    id: "jobseeking",
    label: "Job Application",
    Icon: SearchRoundedIcon,
    followUpQuestion: "What position are you looking for?",
    followUpPlaceholder: "e.g. Product Manager, Data Scientist",
  },
  {
    id: "personal",
    label: "Personal Communication",
    Icon: PersonRoundedIcon,
    followUpQuestion: "Describe your personality briefly.",
    followUpPlaceholder: "e.g. introverted and prefer concise replies",
  },
  {
    id: "promotion",
    label: "Marketing & Promotions",
    Icon: LocalOfferRoundedIcon,
    followUpQuestion: null,
  },
  {
    id: "alert",
    label: "Account Notifications & Transaction Alerts",
    Icon: NotificationsRoundedIcon,
    followUpQuestion: "Where do you usually live?",
    followUpPlaceholder: "e.g. Tokyo, Japan",
  },
  {
    id: "documents",
    label: "Document & File Sharing & Record Keeping",
    Icon: FolderRoundedIcon,
    followUpQuestion: null,
  },
  {
    id: "newsletter",
    label: "Newsletters & Subscriptions",
    Icon: MailRoundedIcon,
    followUpQuestion: null,
  },
];

type WizardPhase = "usecases" | "followups" | "notifications" | "completing";

export function OnboardingWizard({ userName, vapidPublicKey }: { userName: string; vapidPublicKey?: string }) {
  const theme = useTheme();
  const { update } = useSession();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<WizardPhase>("usecases");
  const [selectedIds, setSelectedIds] = useState<UseCaseId[]>([]);

  // Follow-up state
  const [followUpQueue, setFollowUpQueue] = useState<UseCaseId[]>([]);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<UseCaseId, string>>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");

  // Notifications step state
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  // ── Use-case selection ──────────────────────────────────────────────────────
  function toggleUseCase(id: UseCaseId) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleUseCasesNext() {
    if (selectedIds.length === 0) return;
    const queue = USE_CASES.filter(
      (uc) => selectedIds.includes(uc.id) && uc.followUpQuestion !== null,
    ).map((uc) => uc.id);

    if (queue.length === 0) {
      if (vapidPublicKey) {
        setPhase("notifications");
      } else {
        submitOnboarding({});
      }
      return;
    }
    setFollowUpQueue(queue);
    setFollowUpIndex(0);
    setCurrentAnswer("");
    setPhase("followups");
  }

  // ── Follow-up answers ───────────────────────────────────────────────────────
  function handleFollowUpNext() {
    const currentId = followUpQueue[followUpIndex];
    const newAnswers: Partial<Record<UseCaseId, string>> = {
      ...answers,
      ...(currentAnswer.trim() ? { [currentId]: currentAnswer.trim() } : {}),
    };
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (followUpIndex + 1 < followUpQueue.length) {
      setFollowUpIndex(followUpIndex + 1);
    } else if (vapidPublicKey) {
      setPhase("notifications");
    } else {
      submitOnboarding(newAnswers);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  function submitOnboarding(finalAnswers: Partial<Record<UseCaseId, string>>) {
    setPhase("completing");
    setError(null);
    startTransition(async () => {
      try {
        await completeOnboarding(selectedIds, finalAnswers);
        await update();
        router.push("/inbox");
      } catch {
        setError("Something went wrong. Please try again.");
        setPhase("followups");
      }
    });
  }

  // ── Progress ────────────────────────────────────────────────────────────────
  const notifStep = vapidPublicKey ? 1 : 0;
  const totalSteps = 1 + followUpQueue.length + notifStep;
  const currentStep =
    phase === "usecases" ? 0
    : phase === "followups" ? 1 + followUpIndex
    : phase === "notifications" ? 1 + followUpQueue.length
    : totalSteps;
  const progressValue = totalSteps > 0 ? (currentStep / (totalSteps + 1)) * 100 : 10;

  // ── Current follow-up metadata ───────────────────────────────────────────────
  const currentFollowUpId = followUpQueue[followUpIndex];
  const currentFollowUp = USE_CASES.find((uc) => uc.id === currentFollowUpId);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          theme.palette.mode === "dark"
            ? "radial-gradient(circle at 15% 25%, rgba(139,92,246,0.18) 0%, transparent 40%), radial-gradient(circle at 85% 75%, rgba(45,212,191,0.15) 0%, transparent 40%), linear-gradient(160deg, #020617 0%, #0f172a 100%)"
            : "radial-gradient(circle at 15% 25%, #ede9fe 0%, transparent 40%), radial-gradient(circle at 85% 75%, #d1fae5 0%, transparent 40%), linear-gradient(160deg, #faf5ff 0%, #ecfdf5 100%)",
      }}
    >
      <Container maxWidth="sm" disableGutters>
        <Card sx={{ p: { xs: 2, sm: 3 }, backdropFilter: "blur(8px)" }}>
          <CardContent>
            <Stack spacing={3}>
              {/* Header */}
              <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    boxShadow: "0 10px 24px rgba(139,92,246,0.35)",
                  }}
                >
                  <AutoAwesomeRoundedIcon />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Hi {userName}, let&apos;s finish setting up your email agent.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your answers will be used to personalise LLM prompts.
                </Typography>
              </Stack>

              {/* Progress bar */}
              {phase !== "usecases" && (
                <LinearProgress
                  variant="determinate"
                  value={progressValue}
                  sx={{ borderRadius: 4, height: 6 }}
                />
              )}

              {error && <Alert severity="error">{error}</Alert>}

              {/* ── Step: use cases ─────────────────────────────────────────── */}
              {phase === "usecases" && (
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    What do you usually use email for?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Select all that apply.
                  </Typography>

                  <Stack spacing={1}>
                    {USE_CASES.map((uc) => {
                      const isSelected = selectedIds.includes(uc.id);
                      return (
                        <Card
                          key={uc.id}
                          onClick={() => toggleUseCase(uc.id)}
                          elevation={0}
                          sx={{
                            cursor: "pointer",
                            border: "2px solid",
                            borderColor: isSelected ? "primary.main" : "divider",
                            bgcolor: isSelected
                              ? theme.palette.mode === "dark"
                                ? "rgba(139,92,246,0.12)"
                                : "rgba(139,92,246,0.06)"
                              : "background.paper",
                            transition: "border-color 0.15s, background-color 0.15s",
                            "&:hover": {
                              borderColor: "primary.main",
                              bgcolor:
                                theme.palette.mode === "dark"
                                  ? "rgba(139,92,246,0.08)"
                                  : "rgba(139,92,246,0.04)",
                            },
                          }}
                        >
                          <CardContent
                            sx={{
                              py: "10px !important",
                              px: "14px !important",
                              "&:last-child": { pb: "10px !important" },
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1.5}
                              sx={{ alignItems: "center" }}
                            >
                              <Box
                                sx={{
                                  color: isSelected
                                    ? "primary.main"
                                    : "text.secondary",
                                  display: "flex",
                                  flexShrink: 0,
                                }}
                              >
                                <uc.Icon fontSize="small" />
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  flexGrow: 1,
                                  fontWeight: isSelected ? 600 : 400,
                                  color: isSelected
                                    ? "primary.main"
                                    : "text.primary",
                                }}
                              >
                                {uc.label}
                              </Typography>
                              {isSelected && (
                                <CheckCircleRoundedIcon
                                  fontSize="small"
                                  sx={{ color: "primary.main", flexShrink: 0 }}
                                />
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>

                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={selectedIds.length === 0}
                    onClick={handleUseCasesNext}
                  >
                    Continue
                  </Button>
                </Stack>
              )}

              {/* ── Step: follow-up questions ────────────────────────────────── */}
              {phase === "followups" && currentFollowUp && (
                <Stack spacing={2}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {USE_CASES.find((u) => u.id === currentFollowUpId)?.label}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {currentFollowUp.followUpQuestion}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Optional — leave blank to skip personalisation.
                    </Typography>
                  </Stack>

                  <TextField
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder={currentFollowUp.followUpPlaceholder}
                    fullWidth
                    multiline
                    minRows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleFollowUpNext();
                      }
                    }}
                  />

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="text"
                      color="inherit"
                      sx={{ color: "text.secondary" }}
                      onClick={() => {
                        setCurrentAnswer("");
                        handleFollowUpNext();
                      }}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={handleFollowUpNext}
                    >
                      {followUpIndex + 1 < followUpQueue.length
                        ? "Continue"
                        : "Finish setup"}
                    </Button>
                  </Stack>
                </Stack>
              )}

              {/* ── Step: notifications ─────────────────────────────────────── */}
              {phase === "notifications" && vapidPublicKey && (
                <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      boxShadow: "0 10px 24px rgba(139,92,246,0.35)",
                    }}
                  >
                    <NotificationsRoundedIcon />
                  </Box>
                  <Stack spacing={1}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Get notified about priority emails
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Enable browser push notifications to be alerted in real-time
                      when a priority email arrives in your inbox.
                    </Typography>
                  </Stack>

                  {notifError && <Alert severity="error" sx={{ width: "100%", textAlign: "left" }}>{notifError}</Alert>}

                  <Stack spacing={1} sx={{ width: "100%" }}>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={notifBusy}
                      startIcon={notifBusy ? <CircularProgress size={16} color="inherit" /> : <NotificationsRoundedIcon />}
                      onClick={async () => {
                        if (!vapidPublicKey) return;
                        setNotifBusy(true);
                        setNotifError(null);
                        try {
                          await subscribeToWebPush(vapidPublicKey);
                        } catch {
                          setNotifError("Could not enable notifications. You can change this later in Settings.");
                        } finally {
                          setNotifBusy(false);
                          submitOnboarding(answers);
                        }
                      }}
                    >
                      {notifBusy ? "Requesting permission…" : "Enable notifications"}
                    </Button>
                    <Button
                      variant="text"
                      color="inherit"
                      sx={{ color: "text.secondary" }}
                      disabled={notifBusy}
                      onClick={() => submitOnboarding(answers)}
                    >
                      Skip for now
                    </Button>
                  </Stack>
                </Stack>
              )}

              {/* ── Step: completing ─────────────────────────────────────────── */}
              {phase === "completing" && (
                <Stack spacing={2} sx={{ alignItems: "center", py: 2 }}>
                  <CircularProgress size={40} />
                  <Typography color="text.secondary">
                    Setting up your agent…
                  </Typography>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
