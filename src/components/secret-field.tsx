"use client";

import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SecretField({
  value,
  onRotate,
  rotating,
}: {
  value: string;
  onRotate?: () => void;
  rotating?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setRevealed(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        readOnly
        value={revealed ? value : "•".repeat(Math.min(value.length, 36))}
        className="min-w-0 flex-1 font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? "Hide" : "Reveal"}
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={copy}
        aria-label="Copy"
      >
        {copied ? (
          <Check className="size-4 text-emerald-500" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
      {onRotate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRotate}
          disabled={rotating}
        >
          <RefreshCw className={rotating ? "size-4 animate-spin" : "size-4"} />
          Rotate
        </Button>
      ) : null}
    </div>
  );
}
