import type { ColorMode, JobDocument, JobStatus } from "@/lib/types";

export function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  awaiting_payment: "Awaiting payment",
  awaiting_approval: "Needs approval",
  queued: "In queue",
  printing: "Printing",
  printed: "Printed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function colorLabel(color: ColorMode) {
  return color === "color" ? "Colour" : "B&W";
}

function plural(count: number, word: string) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

/**
 * Sits under a file name in the queue, so it has to separate how long the file
 * is from how many times it prints. "2 pages" next to a one-page photo asked
 * for twice reads as a two-page photo.
 */
export function describeDocuments(documents: JobDocument[], totalPages: number) {
  const [only] = documents;
  if (documents.length !== 1 || only == null) {
    return `${plural(documents.length, "file")} · ${plural(totalPages, "page")}`;
  }
  const pages = plural(only.pages, "page");
  return only.copies > 1 ? `${pages} × ${only.copies}` : pages;
}
