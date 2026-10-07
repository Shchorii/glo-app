import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
