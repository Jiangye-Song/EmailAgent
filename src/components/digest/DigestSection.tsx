import { EmailCard } from "@/components/digest/EmailCard";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
};

const CATEGORY_ORDER: EmailRecord["category"][] = [
  "alert",
  "personal",
  "newsletter",
  "promotion",
  "other",
];

export function DigestSection({ records }: Props) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No emails processed yet. Click &quot;Trigger Digest&quot; to start.
      </p>
    );
  }

  // Group by category, in priority order
  const grouped = CATEGORY_ORDER.reduce<
    Partial<Record<EmailRecord["category"], EmailRecord[]>>
  >((acc, cat) => {
    const filtered = records.filter((r) => r.category === cat);
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {(Object.entries(grouped) as [EmailRecord["category"], EmailRecord[]][]).map(
        ([category, emails]) => (
          <section key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {category} ({emails.length})
            </h3>
            <div className="space-y-3">
              {emails.map((record) => (
                <EmailCard key={record.id} record={record} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
