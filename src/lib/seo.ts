import type { Metadata } from "next";

/** Production origin. `metadataBase` in the root layout resolves relative canonicals against this. */
export const SITE_URL = "https://app.we-are-glo.com";
export const SITE_NAME = "Glo Campaign Manager";

/** Public routes that should rank. Everything else is noindex,follow. Used by app/sitemap.ts. */
export const INDEXABLE_ROUTES = ["/", "/book/"] as const;

type RouteSeo = {
  /** Path exactly as served (next.config has trailingSlash: true), e.g. "/book/". */
  path: string;
  /** A string gets the " · Glo Campaign Manager" suffix (absolute, so nested segments don't lose it). */
  title?: string | { absolute: string };
  description?: string;
  /** Defaults to false: auth, account and utility routes stay out of the index but links are followed. */
  index?: boolean;
};

/** Self-referencing canonical + robots for one route. */
export function routeMetadata({ path, title, description, index = false }: RouteSeo): Metadata {
  return {
    ...(title !== undefined
      ? { title: typeof title === "string" ? { absolute: `${title} · ${SITE_NAME}` } : title }
      : {}),
    ...(description !== undefined ? { description } : {}),
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
  };
}
