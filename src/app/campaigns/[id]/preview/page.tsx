import PreviewClient from "./PreviewClient";

export function generateStaticParams() {
  return [{ id: "camp_jp_001" }];
}
export const dynamicParams = false;

export default function PreviewPage() {
  return <PreviewClient />;
}
