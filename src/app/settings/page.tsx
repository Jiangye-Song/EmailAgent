import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { RulesEditor } from "@/components/settings/RulesEditor";
import { ForwardingInfo } from "@/components/settings/ForwardingInfo";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { Separator } from "@/components/ui/separator";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Settings</span>
          </div>
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inbox
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Forwarding address section */}
        <section className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">Your forwarding address</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add this address to the auto-forward rules in your email app. Every
              email forwarded here will be processed by the AI and appear in your
              inbox.
            </p>
          </div>
          <Separator />
          <ForwardingInfo address={forwardingAddress} />
        </section>

        {/* Rules section */}
        <section className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">AI rules</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Write plain-language rules to guide how your emails are classified
              and acted on. Rules are applied by{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                qwen3.7-max
              </code>{" "}
              during processing.
            </p>
          </div>
          <Separator />
          <RulesEditor initialRules={rules} />
        </section>
      </main>
    </div>
  );
}
