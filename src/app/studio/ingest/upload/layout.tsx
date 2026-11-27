import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/studio/ingest/upload/",
  title: "Upload a video",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
