import { format, parseISO } from 'date-fns';
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
export function formatDate(d: string | Date): string {
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'MMM d, yyyy'); } catch { return String(d); }
}
