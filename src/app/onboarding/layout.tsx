import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/onboarding/",
  title: "Set up your business",
  description: "Tell Glo about your business to finish setting up your account.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
