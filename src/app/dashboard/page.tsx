import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, LogOut, Inbox } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const initials = session.user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Email Digest Agent</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session.user?.image ?? undefined} alt={session.user?.name ?? "User"} />
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
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Good morning, {session.user?.name?.split(" ")[0]} 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your email digest is ready. Connect Gmail to start processing.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Phase 1 — Auth ✓
          </Badge>
        </div>

        <Separator />

        {/* Placeholder content — Phase 3 will populate this */}
        <div className="rounded-lg border border-dashed bg-white dark:bg-zinc-900 p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/50" />
          <h2 className="font-medium text-muted-foreground">No emails processed yet</h2>
          <p className="text-sm text-muted-foreground/75 max-w-sm">
            Once Gmail is connected and you trigger a fetch, your digest will appear here.
            Coming in Phase 3.
          </p>
        </div>
      </main>
    </div>
  );
}
