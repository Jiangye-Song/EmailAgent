"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Archive, Reply } from "lucide-react";
import { approveAction, rejectAction } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";

const ACTION_LABELS: Record<
  Exclude<EmailRecord["recommended_action"], "keep">,
  { label: string; icon: React.ReactNode; className: string }
> = {
  archive: {
    label: "Archive",
    icon: <Archive className="h-3 w-3" />,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
  draft_reply: {
    label: "Draft Reply",
    icon: <Reply className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

type Props = {
  record: EmailRecord;
};

export function ActionItem({ record }: Props) {
  const [isPending, startTransition] = useTransition();

  const actionMeta =
    ACTION_LABELS[record.recommended_action as keyof typeof ACTION_LABELS];

  const handleApprove = () => {
    startTransition(async () => {
      await approveAction(record.id);
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectAction(record.id);
    });
  };

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{record.subject}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {record.sender}
          </p>
        </div>
        {actionMeta && (
          <Badge
            variant="outline"
            className={`text-xs shrink-0 gap-1 ${actionMeta.className}`}
          >
            {actionMeta.icon}
            {actionMeta.label}
          </Badge>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {record.summary}
      </p>

      {/* Approve / Reject */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleApprove}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={handleReject}
          disabled={isPending}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}
