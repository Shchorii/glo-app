// Daypart catalog. Each slot prices as a share of the full daily rate;
// picking everything (or nothing) equals all-day at 1.0x.
// KEEP IN SYNC with supabase/functions/checkout/index.ts (server recomputes independently).
export type Daypart = { id: string; label: string; range: string; share: number; note?: string };

export const DAYPARTS: Daypart[] = [
  { id: "morning_rush", label: "Morning rush", range: "7-9am",     share: 0.35, note: "premium" },
  { id: "daytime",      label: "Daytime",      range: "9am-5pm",   share: 0.4 },
  { id: "evening_rush", label: "Evening rush", range: "5-7pm",     share: 0.35, note: "premium" },
  { id: "evening",      label: "Evening",      range: "7-10pm",    share: 0.25 },
  { id: "late_night",   label: "Late night",   range: "10pm-12am", share: 0.15, note: "cheaper" },
];

export function daypartMultiplier(ids: string[]): number {
  if (!ids.length || ids.includes("all_day")) return 1;
  const sum = DAYPARTS.filter((d) => ids.includes(d.id)).reduce((a, d) => a + d.share, 0);
  return Math.min(sum || 1, 1);
}

export function daypartSummary(ids: string[]): string {
  if (!ids.length || ids.includes("all_day")) return "All day";
  return DAYPARTS.filter((d) => ids.includes(d.id)).map((d) => `${d.label} ${d.range}`).join(", ");
}
