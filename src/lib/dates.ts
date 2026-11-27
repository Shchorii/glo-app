/** YYYY-MM-DD in the user's local time zone. UTC `toISOString()` is yesterday between local midnight and the UTC offset. */
export function localTodayISO(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function addIsoDays(iso: string, days: number): string {
  const utc = new Date(`${iso}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export type ClampedFlight = { start: string; end: string; shifted: boolean };

/**
 * Pull a flight that starts before `today` forward, keeping the same number of days.
 * `end` is also raised to `start` when the range is inverted.
 * Date-only strings are compared and shifted in UTC so a DST boundary cannot change the length.
 */
export function clampFlight(start: string, end: string, today: string): ClampedFlight {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || !ISO_DATE.test(today)) {
    return { start, end, shifted: false };
  }

  let nextStart = start;
  let nextEnd = end;
  let shifted = false;

  if (nextStart < today) {
    const delta = Math.round(
      (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${nextStart}T00:00:00Z`).getTime()) / DAY_MS,
    );
    nextStart = addIsoDays(nextStart, delta);
    nextEnd = addIsoDays(nextEnd, delta);
    shifted = true;
  }

  if (nextEnd < nextStart) {
    nextEnd = nextStart;
    shifted = true;
  }

  return { start: nextStart, end: nextEnd, shifted };
}
