import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = routeMetadata({
  path: "/book/",
  title: "Book Neighborhood Screens",
  description: "Search screens near any address, pick blocks and dayparts, and book a neighborhood screen campaign with Glo.",
  index: true,
});

export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
