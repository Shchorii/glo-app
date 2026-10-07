import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  path: "/sign-up/",
  title: "Create your account",
  description: "Create a Glo Campaign Manager account and launch your first neighborhood screen campaign.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
