"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import NotificationsOffRoundedIcon from "@mui/icons-material/NotificationsOffRounded";
import { subscribeToWebPush, unsubscribeFromWebPush } from "@/lib/push/subscribe";

type PermissionStatus = "loading" | "unsupported" | "default" | "granted" | "denied";

export function NotificationToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [permission, setPermission] = useState<PermissionStatus>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionStatus);
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub)),
    );
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const ok = await subscribeToWebPush(vapidPublicKey);
      if (ok) {
        setPermission("granted");
        setSubscribed(true);
      } else {
        setPermission(Notification.permission as PermissionStatus);
        if (Notification.permission === "denied") {
          setError(null); // show the denied alert instead
        } else {
          setError("Could not enable notifications. Please try again.");
        }
      }
    } catch {
      setError("Failed to enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromWebPush();
      setSubscribed(false);
    } catch {
      setError("Failed to disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (permission === "loading") {
    return <CircularProgress size={20} />;
  }

  if (permission === "unsupported") {
    return (
      <Alert severity="info" icon={<NotificationsOffRoundedIcon fontSize="inherit" />}>
        Push notifications are not supported in this browser.
      </Alert>
    );
  }

  if (permission === "denied") {
    return (
      <Alert severity="warning" icon={<NotificationsOffRoundedIcon fontSize="inherit" />}>
        Notifications are blocked in your browser. To re-enable, click the lock
        icon in the address bar, allow notifications, then reload.
      </Alert>
    );
  }

  const isOn = permission === "granted" && subscribed;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      <FormControlLabel
        control={
          <Switch
            checked={isOn}
            disabled={busy}
            onChange={isOn ? handleDisable : handleEnable}
          />
        }
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isOn ? (
              <NotificationsRoundedIcon fontSize="small" color="primary" />
            ) : (
              <NotificationsOffRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
            )}
            <Typography variant="body2">
              {busy
                ? isOn
                  ? "Disabling…"
                  : "Enabling…"
                : isOn
                  ? "Push notifications enabled"
                  : "Push notifications disabled"}
            </Typography>
            {busy && <CircularProgress size={14} />}
          </Box>
        }
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {isOn
          ? "You will be notified when a priority email arrives."
          : "Enable to get notified instantly when a priority email arrives."}
      </Typography>
    </Box>
  );
}
