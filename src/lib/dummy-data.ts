// Hardcoded demo data for closed-beta / pre-D1 state.
// Swap to D1 reads once CLOUDFLARE_API_TOKEN is provisioned.

export type Surface = "dooh" | "ctv" | "venue" | "pub" | "mobile";

export const dummyWorkspace = {
  id: "ws_johnnys",
  name: "Johnny's Pizza · Williamsburg",
};

export const dummyCreatives = [
  {
    id: "cre_jp_friday_v1",
    workspaceId: "ws_johnnys",
    name: "Friday Night Special — 15s vertical",
    source: "upload" as const,
    mediaType: "video" as const,
    aspectRatio: "9:16",
    durationSeconds: 15,
    thumbnailUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=70",
    status: "ready" as const,
    createdAt: new Date("2026-05-13T16:00:00Z").getTime(),
  },
  {
    id: "cre_jp_friday_v2",
    workspaceId: "ws_johnnys",
    name: "Friday Night Special — 15s horizontal",
    source: "ai_gen" as const,
    mediaType: "video" as const,
    aspectRatio: "16:9",
    durationSeconds: 15,
    thumbnailUrl: "https://images.unsplash.com/photo-1593504049359-74330189a345?w=400&q=70",
    status: "ready" as const,
    parentCreativeId: "cre_jp_friday_v1",
    metadata: { model: "seedance-v1-pro", provider: "fal" },
    createdAt: new Date("2026-05-13T17:30:00Z").getTime(),
  },
];

export const dummyCampaign = {
  id: "camp_jp_001",
  workspaceId: "ws_johnnys",
  name: "Friday Night Special — Brooklyn",
  status: "live" as const,
  surfaces: ["dooh", "ctv"] as Surface[],
  budgetCents: 150000,        // $1,500
  spentCents: 118400,         // 79% of budget (~$84.57/day across 14 days)
  dailyCapCents: 11000,       // ~$110/day cap (down from $215)
  startsAt: new Date("2026-05-14T00:00:00Z").getTime(),
  endsAt:   new Date("2026-06-04T00:00:00Z").getTime(),  // 21-day campaign, 7 days left
  targeting: {
    neighborhoods: ["Williamsburg", "Bushwick", "Greenpoint"],
    blocks: [
      "Bedford & N 7th",
      "Wythe & N 6th",
      "Driggs & Metropolitan",
      "Knickerbocker & Troutman",
      "Manhattan & Calyer",
    ],
    dayparts: ["evening", "late-night"],
  },
  createdAt: new Date("2026-05-13T19:00:00Z").getTime(),
};

export type Metrics = {
  totals: { impressions: number; completions: number; clicks: number; spentCents: number; ecpmCents: number };
  bySurface: Record<Surface, { impressions: number; completions: number; clicks: number; spentCents: number }>;
  byNeighborhood: { name: string; impressions: number; completionRate: number; spentCents: number }[];
  timeline: { date: string; label: string; impressions: number }[];
  topBlocks: { neighborhood: string; corner: string; surface: Surface; impressions: number }[];
};

export const dummyMetrics: Metrics = {
  totals: {
    impressions: 83645,
    completions: 59987,
    clicks: 387,
    spentCents: 118400,
    ecpmCents: 1416, // $14.16
  },
  bySurface: {
    dooh: { impressions: 36124, completions: 31934, clicks: 0,   spentCents: 49200 },
    ctv:  { impressions: 47521, completions: 28053, clicks: 387, spentCents: 69200 },
    venue: { impressions: 0, completions: 0, clicks: 0, spentCents: 0 },
    pub:   { impressions: 0, completions: 0, clicks: 0, spentCents: 0 },
    mobile:{ impressions: 0, completions: 0, clicks: 0, spentCents: 0 },
  },
  byNeighborhood: [
    { name: "Williamsburg", impressions: 38420, completionRate: 0.745, spentCents: 54200 },
    { name: "Bushwick",     impressions: 28900, completionRate: 0.692, spentCents: 41800 },
    { name: "Greenpoint",   impressions: 16325, completionRate: 0.712, spentCents: 22400 },
  ],
  // 14-day window, May 14–27, 2026. Two Fridays (15, 22) peak; weekends carry.
  timeline: [
    { date: "2026-05-14", label: "Thu", impressions:  2_810 },
    { date: "2026-05-15", label: "Fri", impressions:  8_120 },
    { date: "2026-05-16", label: "Sat", impressions:  9_240 },
    { date: "2026-05-17", label: "Sun", impressions:  6_820 },
    { date: "2026-05-18", label: "Mon", impressions:  4_410 },
    { date: "2026-05-19", label: "Tue", impressions:  4_780 },
    { date: "2026-05-20", label: "Wed", impressions:  4_920 },
    { date: "2026-05-21", label: "Thu", impressions:  5_180 },
    { date: "2026-05-22", label: "Fri", impressions:  9_410 },
    { date: "2026-05-23", label: "Sat", impressions:  9_915 },
    { date: "2026-05-24", label: "Sun", impressions:  6_745 },
    { date: "2026-05-25", label: "Mon", impressions:  4_610 },
    { date: "2026-05-26", label: "Tue", impressions:  4_785 },
    { date: "2026-05-27", label: "Wed", impressions:  1_900 }, // today, partial
  ],
  topBlocks: [
    { neighborhood: "Williamsburg", corner: "Bedford & N 7th",         surface: "dooh", impressions: 9_420 },
    { neighborhood: "Williamsburg", corner: "Wythe & N 6th",            surface: "dooh", impressions: 8_215 },
    { neighborhood: "Bushwick",     corner: "Knickerbocker & Troutman", surface: "dooh", impressions: 7_840 },
    { neighborhood: "Williamsburg", corner: "Driggs & Metropolitan",    surface: "dooh", impressions: 6_120 },
    { neighborhood: "Greenpoint",   corner: "Manhattan & Calyer",       surface: "dooh", impressions: 4_529 },
  ],
};

export const SURFACE_META: Record<Surface, { label: string; tone: string }> = {
  dooh:   { label: "Sidewalk DOOH",     tone: "cy" },
  ctv:    { label: "Connected TV",      tone: "lime" },
  venue:  { label: "In-venue TVs",      tone: "cy" },
  pub:    { label: "Premium publishers", tone: "lime" },
  mobile: { label: "Geo-fenced mobile",  tone: "cy" },
};

// Helpers
export const fmtCents = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const fmtInt = (n: number) => n.toLocaleString();
export const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

// ---- DOOH QR coupon offer ----
export const dummyOffer = {
  code: "JP-FRIDAY10",
  brand: "Johnny's Pizza",
  headline: "10% off your next order",
  detail: "Show this code at Johnny's Pizza · Bedford Ave. One per customer. Valid through Jun 4.",
  discountPct: 10,
  campaignId: "camp_jp_001",
  // Seed funnel (mirrors the GitHub store seed; used as fallback if store unreachable)
  seedScans: 1284,
  seedRedemptions: 312,
};
export const couponUrl = (code: string) => `https://app.we-are-glo.com/c/${code}`;
