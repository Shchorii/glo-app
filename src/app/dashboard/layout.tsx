import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = routeMetadata({
  path: "/dashboard/",
  title: "Dashboard",
  description: "Your Glo campaign dashboard.",
});

export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
