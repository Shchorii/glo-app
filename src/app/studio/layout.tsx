import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = routeMetadata({
  path: "/studio/",
  title: "Creative Studio",
  description: "Make street-ready creatives for neighborhood screens.",
});

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
