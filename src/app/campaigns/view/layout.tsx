import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/campaigns/view/",
  title: "Campaign",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
