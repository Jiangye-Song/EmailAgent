import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { RulesEditor } from "@/components/settings/RulesEditor";
import { CredentialsForm } from "@/components/settings/CredentialsForm";
import { getCredentialMeta } from "@/lib/actions/credential-actions";
import { Separator } from "@/components/ui/separator";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

  const [rules, credentialMeta] = await Promise.all([
    getUserRules(session.user.id),
    getCredentialMeta(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Settings</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Email account section */}
        <section className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">Email account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your mailbox via IMAP/SMTP. Works with Gmail, Outlook,
              Fastmail, Yahoo, or any standard mail server.
            </p>
          </div>
          <Separator />
          <CredentialsForm existing={credentialMeta} />
        </section>

        {/* Rules section */}
        <section className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">User-defined rules</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Write plain-language rules to guide how your emails are classified
              and acted on. Rules are applied by{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                qwen3.7-max
              </code>{" "}
              during each digest run.
            </p>
          </div>
          <Separator />
          <RulesEditor initialRules={rules} />
        </section>
      </main>
    </div>
  );
}
