import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = routeMetadata({
  path: "/library/",
  title: "Creative Library",
  description: "Your saved Glo creatives.",
});

export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
