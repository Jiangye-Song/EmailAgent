"use client";

import { useState, useTransition } from "react";
import { Check, X, Reply, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { approveAction, rejectAction } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";

type Props = {
  record: EmailRecord | null;
  forwardingAddress: string;
};

export function EmailDetail({ record, forwardingAddress }: Props) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  if (!record) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
        <p className="text-sm">Select an email to read</p>
        <p className="text-xs">
          Forward your Gmail to{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
            {forwardingAddress}
          </code>
        </p>
      </div>
    );
  }

  // After the null guard above, record is non-null for the rest of the component.
  // Capture it in a const so closures below don't see the nullable type.
  const rec = record;

  const status = localStatus ?? rec.action_status;

  const mailtoUrl =
    `mailto:${encodeURIComponent(rec.sender)}` +
    `?subject=${encodeURIComponent(`Re: ${rec.subject}`)}` +
    `&body=${encodeURIComponent(rec.draft_body ?? "")}`;

  function handleApprove() {
    startTransition(async () => {
      const url = await approveAction(rec.id);
      setLocalStatus("executed");
      if (url) window.open(url, "_blank");
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectAction(rec.id);
      setLocalStatus("rejected");
    });
  }

  const hasCalendar =
    Array.isArray(rec.calendar_events) && rec.calendar_events.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <h2 className="text-base font-semibold leading-tight mb-1">
          {rec.subject}
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>
            <span className="font-medium text-foreground">From:</span>{" "}
            {rec.sender}
          </span>
          {rec.received_at && (
            <span>
              {new Date(rec.received_at).toLocaleString()}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] capitalize">
            {rec.category}
          </Badge>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-b px-6 py-2 flex items-center gap-2 shrink-0 bg-zinc-50 dark:bg-zinc-900">
        {status === "pending" ? (
          <>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={isPending}
            >
              <Check className="h-3 w-3" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleReject}
              disabled={isPending}
            >
              <X className="h-3 w-3" />
              Reject
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="text-[10px] capitalize">
            {status}
          </Badge>
        )}

        <a href={mailtoUrl}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
            <Reply className="h-3 w-3" />
            Reply
          </Button>
        </a>

        {hasCalendar && (
          <a href={`/api/ics/${rec.id}`} download>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
              <CalendarPlus className="h-3 w-3" />
              Add to Cal
            </Button>
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* AI Summary */}
        <div className="border-l-4 border-violet-400 pl-3 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-1">
            Summary
          </p>
          <p className="text-sm">{rec.summary}</p>
        </div>

        {/* Action Items */}
        {rec.todos?.length > 0 && (
          <div className="border-l-4 border-yellow-400 pl-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-600 mb-1">
              Action Items
            </p>
            <ul className="space-y-1">
              {rec.todos.map((todo, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-yellow-500 shrink-0">•</span>
                  {todo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Draft body preview */}
        {rec.draft_body && (
          <div className="border-l-4 border-blue-400 pl-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mb-1">
              Draft Reply
            </p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {rec.draft_body}
            </p>
          </div>
        )}

        {/* Calendar events */}
        {hasCalendar && (
          <div className="border-l-4 border-green-400 pl-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600 mb-1">
              Calendar Events
            </p>
            <ul className="space-y-1">
              {rec.calendar_events.map((evt, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{evt.title}</span>
                  {" — "}
                  <span className="text-muted-foreground">
                    {new Date(evt.start).toLocaleString()}
                    {evt.end ? ` → ${new Date(evt.end).toLocaleString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
