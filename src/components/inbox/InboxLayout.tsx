"use client";

import { useState } from "react";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import { EmailList } from "@/components/inbox/EmailList";
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
      <InboxSidebar
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedId(null);
        }}
      />
      <div className="w-64 border-r shrink-0 flex flex-col overflow-hidden">
        <EmailList
          records={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs text-muted-foreground">
        {selectedRecord ? `Selected: ${selectedRecord.subject}` : `Forward to: ${forwardingAddress}`}
      </div>
    </div>
  );
}
