import { dummyCampaign } from "@/lib/dummy-data";
import { redirect } from "next/navigation";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Redirect detail to dashboard for now (MVP: dashboard IS the detail view for the single campaign)
  if (id === dummyCampaign.id) redirect("/dashboard");
  redirect("/campaigns");
}
