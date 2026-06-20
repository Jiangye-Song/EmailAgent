import { ActionItem } from "@/components/hitl/ActionItem";
import { CheckCircle } from "lucide-react";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
};

export function ActionQueue({ records }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <CheckCircle className="h-8 w-8 text-green-500/60" />
        <p className="text-sm font-medium text-muted-foreground">
          All clear — no pending actions
        </p>
        <p className="text-xs text-muted-foreground/70">
          Emails flagged for archive or draft reply will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <ActionItem key={record.id} record={record} />
      ))}
    </div>
  );
}
