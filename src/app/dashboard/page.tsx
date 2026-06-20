import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { pool } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DigestSection } from "@/components/digest/DigestSection";
import { ActionQueue } from "@/components/hitl/ActionQueue";
import { TriggerButton } from "@/components/dashboard/TriggerButton";
import { Mail, LogOut } from "lucide-react";
import type { EmailRecord } from "@/types/db";

async function getEmailRecords(userId: string): Promise<EmailRecord[]> {
  const { rows } = await pool.query<EmailRecord>(
    `SELECT id, gmail_id, subject, sender, received_at, category, summary,
            todos, recommended_action, action_status, raw_snippet, processed_at
     FROM email_records
     WHERE user_id = $1
     ORDER BY processed_at DESC
     LIMIT 100`,
    [userId],
  );
  // pg returns jsonb columns as objects already — todos is already string[]
  return rows;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const records = await getEmailRecords(session.user.id);

  const pendingActions = records.filter(
    (r) => r.action_status === "pending" && r.recommended_action !== "keep",
  );

  const stats = {
    total: records.length,
    pending: pendingActions.length,
    byCategory: records.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const initials =
    session.user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  const firstName = session.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Email Digest Agent</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={session.user?.image ?? undefined}
                alt={session.user?.name ?? "User"}
              />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground hidden sm:block">
              {session.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="sm" type="submit" className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Page title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Good morning, {firstName} 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats.total === 0
                ? "No emails processed yet — trigger a digest to get started."
                : `${stats.total} email${stats.total !== 1 ? "s" : ""} processed · ${stats.pending} pending action${stats.pending !== 1 ? "s" : ""}`}
            </p>
          </div>
          <TriggerButton />
        </div>

        {/* Quick stats */}
        {stats.total > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).map(([cat, count]) => (
              <Badge key={cat} variant="secondary" className="text-xs capitalize">
                {cat}: {count}
              </Badge>
            ))}
          </div>
        )}

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="digest">
          <TabsList>
            <TabsTrigger value="digest">
              Digest
              {stats.total > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1.5">
                  {stats.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="queue">
              Action Queue
              {stats.pending > 0 && (
                <Badge className="ml-1.5 text-xs h-4 px-1.5 bg-orange-500 text-white">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="digest" className="mt-4">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <DigestSection records={records} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <ActionQueue records={pendingActions} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

