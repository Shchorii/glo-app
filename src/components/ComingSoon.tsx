import { PageContainer } from "@/components/PageContainer";

/** Placeholder page: a chip, a title, and a "coming soon" note in a card. */
export function ComingSoon({
  chip,
  title,
  body,
  size = "md",
}: {
  chip: string;
  title: string;
  body: string;
  size?: "md" | "lg";
}) {
  return (
    <PageContainer size={size}>
      <p className="chip mb-3">{chip}</p>
      <h1 className="text-3xl font-semibold text-ink-50 tracking-tight mb-4">{title}</h1>
      <div className="card p-6 md:p-10 text-center text-sm text-ink-400">{body}</div>
    </PageContainer>
  );
}
