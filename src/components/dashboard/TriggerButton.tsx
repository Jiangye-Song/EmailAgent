"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

type Props = {
  /** How many unread emails to fetch per trigger */
  limit?: number;
};

export function TriggerButton({ limit = 20 }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const trigger = async () => {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/process-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Processing failed");
      }

      if (data.count === 0 || data.processed === 0) {
        setMessage("No unread emails found.");
      } else {
        setMessage(
          `Processed ${data.processed} email${data.processed !== 1 ? "s" : ""}.${
            data.errors > 0 ? ` (${data.errors} error${data.errors !== 1 ? "s" : ""})` : ""
          }`,
        );
      }

      setState("done");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      // Reset back to idle after 4 s
      setTimeout(() => {
        setState("idle");
        setMessage(null);
      }, 4_000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={trigger}
        disabled={state === "loading"}
        variant={state === "error" ? "destructive" : "default"}
        className="gap-2"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {state === "loading" ? "Processing…" : "Trigger Digest"}
      </Button>
      {message && (
        <p
          className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
