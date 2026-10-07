import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import PreviewClient from "./PreviewClient";

export function generateStaticParams() {
  return [{ id: "camp_jp_001" }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return routeMetadata({ path: `/campaigns/${id}/preview/`, title: "Campaign preview" });
}

export default function PreviewPage() {
  return <PreviewClient />;
}
