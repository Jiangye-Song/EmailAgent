"use client";

import { Bell, User, Tag, Megaphone, Archive, Settings, Mail } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "all", label: "All", icon: Mail },
  { key: "alert", label: "Alerts", icon: Bell },
  { key: "personal", label: "Personal", icon: User },
  { key: "newsletter", label: "Newsletter", icon: Tag },
  { key: "promotion", label: "Promotions", icon: Megaphone },
  { key: "other", label: "Other", icon: Archive },
] as const;

type Props = {
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
};

export function InboxSidebar({ categoryCounts, selectedCategory, onSelectCategory }: Props) {
  return (
    <div className="w-28 border-r shrink-0 flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
      <div className="px-3 py-4 border-b">
        <div className="flex items-center gap-1.5">
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold truncate">Inbox</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const count = categoryCounts[key] ?? 0;
          const isSelected = selectedCategory === key;
          return (
            <button
              key={key}
              onClick={() => onSelectCategory(key)}
              className={cn(
                "w-full flex flex-col items-center gap-1 rounded-md py-2 px-1 text-center transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Link
          href="/settings"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Settings className="h-4 w-4" />
          <span className="text-[10px]">Settings</span>
        </Link>
      </div>
    </div>
  );
}
