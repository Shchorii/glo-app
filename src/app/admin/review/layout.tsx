import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/admin/review/",
  title: "Review queue",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
