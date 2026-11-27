import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/waitlist/",
  title: "Join the waitlist",
  description: "Join the Glo waitlist and be first to light up your neighborhood.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
