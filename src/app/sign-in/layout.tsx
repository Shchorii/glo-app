import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/sign-in/",
  title: "Sign in",
  description: "Sign in to Glo Campaign Manager to create creatives and manage your neighborhood screen campaigns.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
