"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveRules } from "@/lib/actions/rules-actions";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

const EXAMPLES = [
  "Always keep emails from school",
  "Archive promotions unless discount > 40%",
  "Never send emails without my approval",
  "Flag emails related to jobs, invoices, and interviews",
];

type Props = {
  initialRules: string[];
};

export function RulesEditor({ initialRules }: Props) {
  const [rules, setRules] = useState<string[]>(
    initialRules.length > 0 ? initialRules : [""],
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const updateRule = (index: number, value: string) => {
    setRules((prev) => prev.map((r, i) => (i === index ? value : r)));
    setSaved(false);
  };

  const addRule = () => {
    setRules((prev) => [...prev, ""]);
    setSaved(false);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const addExample = (example: string) => {
    setRules((prev) => {
      // Replace last empty rule or append
      const lastEmpty = prev.findLastIndex((r) => !r.trim());
      if (lastEmpty >= 0) {
        return prev.map((r, i) => (i === lastEmpty ? example : r));
      }
      return [...prev, example];
    });
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveRules(rules);
      setSaved(true);
    });
  };

  return (
    <div className="space-y-6">
      {/* Rule inputs */}
      <div className="space-y-3">
        {rules.map((rule, i) => (
          <div key={i} className="flex gap-2">
            <Textarea
              value={rule}
              onChange={(e) => updateRule(i, e.target.value)}
              placeholder={`Rule ${i + 1} — e.g. "Archive all newsletters"`}
              className="resize-none min-h-[60px]"
              rows={2}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRule(i)}
              disabled={rules.length === 1}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add rule button */}
      <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Add rule
      </Button>

      {/* Example rules */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Examples — click to add
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <Badge
              key={ex}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-normal"
              onClick={() => addExample(ex)}
            >
              {ex}
            </Badge>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending} className="gap-2">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save rules
        </Button>
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Rules saved — next digest will apply them.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Rules are evaluated by <code className="text-xs">qwen3.7-max</code>{" "}
        against each email during processing. Use plain language — the AI
        interprets them for you.
      </p>
    </div>
  );
}
