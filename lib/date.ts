export const WEEKDAY_NAMES = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
] as const;

export const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

export const TIME_ZONE = "Europe/Rome";

/** Data di oggi (YYYY-MM-DD) nel fuso italiano. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Ora attuale (HH:MM) nel fuso italiano. */
export function nowTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function parseISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

/** 1 = lunedì ... 7 = domenica */
export function weekdayOf(iso: string): number {
  const day = parseISO(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(monthISO: string, months: number): string {
  const [year, month] = monthISO.split("-").map(Number);
  return toISO(new Date(Date.UTC(year, month - 1 + months, 1)));
}

export function daysInMonth(monthISO: string): number {
  const [year, month] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Griglia del mese, settimane da lunedì a domenica. */
export function monthGrid(monthISO: string): string[] {
  const first = startOfMonth(monthISO);
  const offset = weekdayOf(first) - 1;
  const total = daysInMonth(first);
  const cells = Math.ceil((offset + total) / 7) * 7;
  const gridStart = addDays(first, -offset);
  return Array.from({ length: cells }, (_, index) => addDays(gridStart, index));
}

export function formatShort(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(parseISO(iso));
}

export function formatLong(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseISO(iso));
}

export function monthLabel(monthISO: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(parseISO(startOfMonth(monthISO)));
}

export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Oggi";
  if (iso === addDays(today, 1)) return "Domani";
  if (iso === addDays(today, -1)) return "Ieri";
  return `${WEEKDAY_SHORT[weekdayOf(iso) - 1]} ${formatShort(iso)}`;
}

/**
 * Prima lezione di una materia a partire da una data (compresa).
 * `weekdays` sono i giorni della settimana in cui la materia si fa (1 = lunedì).
 */
export function nextLessonDate(weekdays: number[], fromISO: string): string | null {
  if (weekdays.length === 0) return null;
  for (let offset = 0; offset <= 400; offset += 1) {
    const candidate = addDays(fromISO, offset);
    if (weekdays.includes(weekdayOf(candidate))) return candidate;
  }
  return null;
}

export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0 h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  return hours === 0 ? `${rest} min` : `${hours} h ${rest} min`;
}
