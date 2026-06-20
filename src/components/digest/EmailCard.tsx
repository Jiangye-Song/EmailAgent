import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { EmailRecord } from "@/types/db";

const CATEGORY_STYLES: Record<
  EmailRecord["category"],
  { label: string; className: string }
> = {
  newsletter: {
    label: "Newsletter",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  alert: {
    label: "Alert",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  personal: {
    label: "Personal",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  promotion: {
    label: "Promotion",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  other: {
    label: "Other",
    className: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
};

type Props = {
  record: EmailRecord;
};

export function EmailCard({ record }: Props) {
  const style = CATEGORY_STYLES[record.category];
  const receivedDate = record.received_at
    ? new Date(record.received_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{record.subject}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {record.sender}
            {receivedDate && (
              <span className="ml-2 text-zinc-400">{receivedDate}</span>
            )}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${style.className}`}
        >
          {style.label}
        </Badge>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {record.summary}
      </p>

      {/* Todos */}
      {record.todos.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Action items
            </p>
            <ul className="space-y-1">
              {record.todos.map((todo, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{todo}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
