import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/studio/ingest/embed/",
  title: "Embed a video",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
