"use client";

import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { EmailRecord } from "@/types/db";

const CATEGORY_COLORS: Record<string, string> = {
  alert: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  personal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  newsletter: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  promotion: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

type Props = {
  records: EmailRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function EmailList({ records, selectedId, onSelect }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
        No emails in this category.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y overflow-y-auto">
      {records.map((record) => {
        const isSelected = record.id === selectedId;
        const relativeTime = record.received_at
          ? formatDistanceToNow(new Date(record.received_at), { addSuffix: true })
          : "";

        return (
          <button
            key={record.id}
            onClick={() => onSelect(record.id)}
            className={cn(
              "w-full text-left px-3 py-3 transition-colors border-l-2",
              isSelected
                ? "bg-primary/5 border-l-primary"
                : "border-l-transparent hover:bg-accent",
            )}
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-semibold truncate">
                {record.sender.split("<")[0].trim() || record.sender}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {relativeTime}
              </span>
            </div>
            <p className="text-xs truncate text-foreground/80 mb-1">
              {record.subject}
            </p>
            <span
              className={cn(
                "text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                CATEGORY_COLORS[record.category],
              )}
            >
              {record.category}
            </span>
          </button>
        );
      })}
    </div>
  );
}
