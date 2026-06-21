"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveCredentials,
  deleteCredentials,
  type CredentialInput,
  type CredentialMeta,
} from "@/lib/actions/credential-actions";
import {
  Loader2,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  Wifi,
} from "lucide-react";

// ─── Provider presets ─────────────────────────────────────────────────────────

const PRESETS: Record<
  string,
  { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
> = {
  Gmail: {
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
  },
  Outlook: {
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
  },
  Yahoo: {
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 587,
  },
  Fastmail: {
    imapHost: "imap.fastmail.com",
    imapPort: 993,
    smtpHost: "smtp.fastmail.com",
    smtpPort: 587,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

type TestState = "idle" | "testing" | "ok" | "fail";

type Props = {
  existing: CredentialMeta | null;
};

export function CredentialsForm({ existing }: Props) {
  const [form, setForm] = useState<CredentialInput>({
    imapHost: existing?.imapHost ?? "",
    imapPort: existing?.imapPort ?? 993,
    smtpHost: existing?.smtpHost ?? "",
    smtpPort: existing?.smtpPort ?? 587,
    username: existing?.username ?? "",
    password: "",
  });

  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const patch = (partial: Partial<CredentialInput>) => {
    setForm((f) => ({ ...f, ...partial }));
    setSaved(false);
    setTestState("idle");
  };

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (p) patch(p);
  };

  const handleTest = async () => {
    setTestState("testing");
    setTestError(null);
    try {
      const res = await fetch("/api/credentials/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imapHost: form.imapHost,
          imapPort: form.imapPort,
          username: form.username,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestState("ok");
      } else {
        setTestState("fail");
        setTestError(data.error ?? "Connection failed");
      }
    } catch {
      setTestState("fail");
      setTestError("Network error");
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveCredentials(form);
      setSaved(true);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteCredentials();
      setForm({
        imapHost: "",
        imapPort: 993,
        smtpHost: "",
        smtpPort: 587,
        username: "",
        password: "",
      });
      setSaved(false);
    });
  };

  const canTest =
    form.imapHost && form.imapPort && form.username && form.password;
  const canSave = canTest && form.smtpHost && form.smtpPort;

  return (
    <div className="space-y-5">
      {/* Provider presets */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Quick-fill preset</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((name) => (
            <Button
              key={name}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(name)}
              type="button"
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      {/* IMAP fields */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          IMAP (incoming mail)
        </legend>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium" htmlFor="imap-host">
              Host
            </label>
            <input
              id="imap-host"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="imap.example.com"
              value={form.imapHost}
              onChange={(e) => patch({ imapHost: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="w-24 space-y-1">
            <label className="text-xs font-medium" htmlFor="imap-port">
              Port
            </label>
            <input
              id="imap-port"
              type="number"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.imapPort}
              onChange={(e) => patch({ imapPort: Number(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      {/* SMTP fields */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          SMTP (outgoing mail)
        </legend>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium" htmlFor="smtp-host">
              Host
            </label>
            <input
              id="smtp-host"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="smtp.example.com"
              value={form.smtpHost}
              onChange={(e) => patch({ smtpHost: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="w-24 space-y-1">
            <label className="text-xs font-medium" htmlFor="smtp-port">
              Port
            </label>
            <input
              id="smtp-port"
              type="number"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.smtpPort}
              onChange={(e) => patch({ smtpPort: Number(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      {/* Auth fields */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Authentication
        </legend>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="username">
            Username / Email
          </label>
          <input
            id="username"
            type="email"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
            value={form.username}
            onChange={(e) => patch({ username: e.target.value })}
            autoComplete="username"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="password">
            App Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Use an app-specific password, not your account password"
            value={form.password}
            onChange={(e) => patch({ password: e.target.value })}
            autoComplete="current-password"
          />
          <p className="text-xs text-muted-foreground">
            For Gmail, generate one at{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              myaccount.google.com/apppasswords
            </a>
            . Stored encrypted (AES-256-GCM).
          </p>
        </div>
      </fieldset>

      {/* Test connection result */}
      {testState === "ok" && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          IMAP connection successful
        </div>
      )}
      {testState === "fail" && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{testError}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canTest || testState === "testing"}
            onClick={handleTest}
            type="button"
          >
            {testState === "testing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            Test connection
          </Button>

          <Button
            size="sm"
            disabled={!canSave || isPending}
            onClick={handleSave}
            type="button"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save"}
          </Button>
        </div>

        {existing && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={isPending}
            onClick={handleDelete}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      {existing && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-0.5">
          <p>
            <span className="font-medium">Connected as:</span> {existing.username}
          </p>
          <p>
            <span className="font-medium">IMAP:</span> {existing.imapHost}:
            {existing.imapPort}
          </p>
          <p>
            <span className="font-medium">SMTP:</span> {existing.smtpHost}:
            {existing.smtpPort}
          </p>
          <Badge variant="secondary" className="mt-1">
            Configured
          </Badge>
        </div>
      )}
    </div>
  );
}
