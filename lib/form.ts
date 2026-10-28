export function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidOrNull(value: FormDataEntryValue | null | undefined): string | null {
  const text = str(value);
  return UUID_RE.test(text) ? text : null;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileIcon(mime: string, name: string): string {
  const lower = name.toLowerCase();
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "📕";
  if (mime.startsWith("audio/")) return "🎧";
  if (mime.startsWith("video/")) return "🎬";
  if (lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".odt")) return "📄";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "📊";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "📽️";
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z")) return "🗜️";
  return "📎";
}

/** Limite upload: le funzioni Vercel accettano al massimo ~4,5 MB per richiesta. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
