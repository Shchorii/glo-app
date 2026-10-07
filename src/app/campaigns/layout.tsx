import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = routeMetadata({
  path: "/campaigns/",
  title: "Campaigns",
  description: "Your Glo neighborhood screen campaigns.",
});

export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
