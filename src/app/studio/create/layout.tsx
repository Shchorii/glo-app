import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/studio/create/",
  title: "Create a creative",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
