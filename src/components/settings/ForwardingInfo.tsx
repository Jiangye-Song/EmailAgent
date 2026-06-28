"use client";

import { useState } from "react";
import { Copy, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  address: string;
};

export function ForwardingInfo({ address }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Address display */}
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-mono text-sm flex-1 select-all">{address}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={copyAddress}
          aria-label="Copy forwarding address"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Setup instructions */}
      <div className="space-y-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          How to set up auto-forwarding:
        </p>

        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors">
            <span className="text-xs">▶</span> Gmail
          </summary>
          <ol className="mt-2 ml-4 space-y-1 list-decimal list-inside">
            <li>Open Gmail → Settings (⚙) → <strong>See all settings</strong></li>
            <li>Go to <strong>Forwarding and POP/IMAP</strong> tab</li>
            <li>Click <strong>Add a forwarding address</strong></li>
            <li>Enter <code className="bg-muted px-1 rounded text-xs">{address}</code></li>
            <li>Gmail will send a verification email — confirm it here in your inbox</li>
            <li>Select <strong>Forward a copy of incoming mail</strong></li>
          </ol>
        </details>

        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors">
            <span className="text-xs">▶</span> Outlook / Hotmail
          </summary>
          <ol className="mt-2 ml-4 space-y-1 list-decimal list-inside">
            <li>Open Outlook → Settings (⚙) → <strong>View all Outlook settings</strong></li>
            <li>Go to <strong>Mail → Forwarding</strong></li>
            <li>Enable forwarding and enter <code className="bg-muted px-1 rounded text-xs">{address}</code></li>
            <li>Click <strong>Save</strong></li>
          </ol>
        </details>

        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors">
            <span className="text-xs">▶</span> Apple Mail (iCloud)
          </summary>
          <ol className="mt-2 ml-4 space-y-1 list-decimal list-inside">
            <li>Go to <strong>iCloud.com → Mail → Settings (⚙)</strong></li>
            <li>Click <strong>Rules → Add a rule</strong></li>
            <li>Set condition: <em>Every message</em></li>
            <li>Set action: <em>Forward to</em> → enter <code className="bg-muted px-1 rounded text-xs">{address}</code></li>
          </ol>
        </details>
      </div>
    </div>
  );
}
