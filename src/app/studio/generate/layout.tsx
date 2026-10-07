import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/studio/generate/",
  title: "Generate with AI",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
