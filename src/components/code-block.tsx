"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard needs a secure context; the code is still selectable.
    }
  };

  return (
    <div className={cn("group relative", className)}>
      {language ? (
        <span className="absolute top-2 left-3 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          {language}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={copy}
        aria-label="Copy code"
        className="absolute top-1.5 right-1.5 size-7 text-muted-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-500" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
      <pre
        className={cn(
          "overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed",
          language && "pt-7",
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
