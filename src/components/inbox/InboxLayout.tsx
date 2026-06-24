"use client";

import { useState } from "react";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  categoryCounts: Record<string, number>;
  forwardingAddress: string;
};

export function InboxLayout({ records, categoryCounts, forwardingAddress }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    selectedCategory === "all"
      ? records
      : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <div className="w-28 border-r shrink-0 p-2 text-xs text-muted-foreground">
        Sidebar — {Object.keys(categoryCounts).length} categories
      </div>
      <div className="w-64 border-r shrink-0 overflow-y-auto p-2 text-xs text-muted-foreground">
        List — {filtered.length} emails
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs text-muted-foreground">
        {selectedRecord ? `Selected: ${selectedRecord.subject}` : `Forward to: ${forwardingAddress}`}
      </div>
    </div>
  );
}
