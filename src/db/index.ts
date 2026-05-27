import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID!;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;

async function executeD1(sql: string, params: unknown[], method: "all" | "run" | "get" | "values") {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 query failed: ${res.status} ${text}`);
  }
  const data: { result: Array<{ results: unknown[]; success: boolean }> } = await res.json();
  const first = data.result?.[0];
  if (!first?.success) throw new Error(`D1 query unsuccessful: ${JSON.stringify(data)}`);

  if (method === "all" || method === "values") {
    const rows = first.results as Record<string, unknown>[];
    return { rows: rows.map((r) => Object.values(r)) };
  }
  if (method === "get") {
    const row = (first.results as Record<string, unknown>[])[0];
    return { rows: row ? Object.values(row) : [] };
  }
  return { rows: [] };
}

export const db = drizzle(
  async (sql, params, method) => executeD1(sql, params, method),
  { schema }
);

export * as schema from "./schema";
