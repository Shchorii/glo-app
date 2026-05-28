// Lightweight KV-style store backed by a JSON file in a GitHub repo.
// Same pattern as the kids-game storage. Requires GITHUB_TOKEN + GLO_STORAGE_REPO env.

const REPO = process.env.GLO_STORAGE_REPO || "Shchorii/glo-app-storage";
const FILE = "scans.json";
const TOKEN = process.env.GITHUB_TOKEN;
const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

export type CodeStats = { scans: number; redemptions: number; updatedAt?: string };
type Store = Record<string, CodeStats>;

const SEED: Store = {
  "JP-FRIDAY10": { scans: 1284, redemptions: 312 },
};

async function ghGet(): Promise<{ data: Store; sha: string } | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(API, {
      headers: { Authorization: `token ${TOKEN}`, "User-Agent": "glo-app", Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = Buffer.from(json.content, "base64").toString("utf8");
    return { data: JSON.parse(content), sha: json.sha };
  } catch {
    return null;
  }
}

async function ghPut(data: Store, sha: string): Promise<boolean> {
  if (!TOKEN) return false;
  const body = {
    message: "update scan store",
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    sha,
  };
  const res = await fetch(API, {
    method: "PUT",
    headers: { Authorization: `token ${TOKEN}`, "User-Agent": "glo-app", Accept: "application/vnd.github+json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** Read stats for a code. Falls back to seed if the store is unreachable. */
export async function getStats(code: string): Promise<CodeStats> {
  const store = await ghGet();
  const data = store?.data ?? SEED;
  return data[code] ?? { scans: 0, redemptions: 0 };
}

/** Record one scan for a code. Best-effort with a single retry on write conflict. */
export async function recordScan(code: string): Promise<CodeStats> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const store = await ghGet();
    if (!store) return { ...(SEED[code] ?? { scans: 0, redemptions: 0 }) };
    const cur = store.data[code] ?? { scans: 0, redemptions: 0 };
    const next: CodeStats = { ...cur, scans: cur.scans + 1, updatedAt: new Date().toISOString() };
    const data = { ...store.data, [code]: next };
    const ok = await ghPut(data, store.sha);
    if (ok) return next;
  }
  return SEED[code] ?? { scans: 0, redemptions: 0 };
}
