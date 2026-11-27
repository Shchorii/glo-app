/** Shareable /book query: city, venue, free-text search, and list vs map. */

export type BookView = "list" | "map";

export type BookParams = {
  city: string | null;
  venue: string | null;
  query: string;
  view: BookView;
};

const EMPTY: BookParams = { city: null, venue: null, query: "", view: "map" };

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Parse a search string (`?city=Chicago&view=list` or without the `?`). */
export function parseBookParams(search: string): BookParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const u = new URLSearchParams(raw);
  return {
    city: blankToNull(u.get("city")),
    venue: blankToNull(u.get("venue")),
    query: u.get("q") ?? "",
    view: u.get("view") === "list" ? "list" : "map",
  };
}

/**
 * Write the book params into `search`, preserving unrelated keys.
 * `view` is omitted unless it is list — map is the default.
 */
export function serializeBookParams(search: string, params: BookParams): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const u = new URLSearchParams(raw);
  const set = (key: string, value: string | null) => {
    if (value) u.set(key, value);
    else u.delete(key);
  };
  set("city", params.city);
  set("venue", params.venue);
  set("q", params.query.trim() || null);
  set("view", params.view === "list" ? "list" : null);
  return u.toString();
}

export function bookParamsEqual(a: BookParams, b: BookParams): boolean {
  return a.city === b.city
    && a.venue === b.venue
    && a.query.trim() === b.query.trim()
    && a.view === b.view;
}

/** Browser URL, or the empty map view during static prerender. */
export function readBookParams(): BookParams {
  if (typeof window === "undefined") return EMPTY;
  return parseBookParams(window.location.search);
}
