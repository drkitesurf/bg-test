import { clsx, type ClassValue } from "clsx";
import { format, isBefore, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatNumber(value: number, unit?: string) {
  if (unit === "EUR") return formatCurrency(value, true);
  if (unit === "%") return `${value.toLocaleString()}%`;
  if (unit === "months") return `${value.toLocaleString()} mo`;
  return value.toLocaleString();
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return format(parseISO(value), "MMM d, yyyy");
}

export function isOverdue(value: string | null | undefined) {
  if (!value) return false;
  return isBefore(parseISO(value), new Date(new Date().toDateString()));
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
