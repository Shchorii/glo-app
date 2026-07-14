// Demo QR stats (Johnny's Pizza seed numbers). The old GitHub-backed store
// lived server-side and is gone with static export; real scan counts return
// via delivery_jobs in Phase 4.
export type CodeStats = { scans: number; redemptions: number; updatedAt?: string };

const SEED: Record<string, CodeStats> = {
  "JP-FRIDAY10": { scans: 1284, redemptions: 312 },
};

export async function getStats(code = "JP-FRIDAY10"): Promise<CodeStats> {
  return SEED[code] ?? { scans: 0, redemptions: 0 };
}
