import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ========== Better-Auth tables ==========
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
  userIdx: index("idx_session_user").on(t.userId),
}));

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
  userIdx: index("idx_account_user").on(t.userId),
}));

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// ========== App tables ==========
export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("ownerId").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// M1 — Creative Studio
export const creative = sqliteTable("creative", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  createdById: text("createdById").notNull().references(() => user.id),
  source: text("source", { enum: ["upload", "embed", "ai_gen"] }).notNull(),
  sourceUrl: text("sourceUrl"),
  storageUrl: text("storageUrl"),
  mediaType: text("mediaType", { enum: ["video", "image"] }).notNull(),
  aspectRatio: text("aspectRatio"),
  durationSeconds: integer("durationSeconds"),
  thumbnailUrl: text("thumbnailUrl"),
  parentCreativeId: text("parentCreativeId"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}),
  status: text("status", { enum: ["pending", "processing", "ready", "failed"] }).notNull().default("pending"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
  wsIdx: index("idx_creative_workspace").on(t.workspaceId),
  parentIdx: index("idx_creative_parent").on(t.parentCreativeId),
}));

export const aiJob = sqliteTable("ai_job", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  creativeId: text("creativeId").references(() => creative.id),
  provider: text("provider", { enum: ["fal", "higgsfield"] }).notNull(),
  model: text("model").notNull(),
  prompt: text("prompt"),
  inputCreativeId: text("inputCreativeId").references(() => creative.id),
  externalJobId: text("externalJobId"),
  status: text("status", { enum: ["queued", "running", "succeeded", "failed"] }).notNull().default("queued"),
  resultUrl: text("resultUrl"),
  error: text("error"),
  costCredits: integer("costCredits"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
  wsIdx: index("idx_aijob_workspace").on(t.workspaceId),
  statusIdx: index("idx_aijob_status").on(t.status),
}));

// M2 — Campaigns
export const campaign = sqliteTable("campaign", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status", { enum: ["draft", "submitted", "live", "paused", "completed"] }).notNull().default("draft"),
  targeting: text("targeting", { mode: "json" }).$type<Record<string, unknown>>().default({}),
  surfaces: text("surfaces", { mode: "json" }).$type<string[]>().default([]),
  budgetCents: integer("budgetCents").notNull().default(0),
  dailyCapCents: integer("dailyCapCents"),
  startsAt: integer("startsAt", { mode: "timestamp" }),
  endsAt: integer("endsAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
  wsIdx: index("idx_campaign_workspace").on(t.workspaceId),
}));

export const creativeAssignment = sqliteTable("creative_assignment", {
  id: text("id").primaryKey(),
  campaignId: text("campaignId").notNull().references(() => campaign.id, { onDelete: "cascade" }),
  creativeId: text("creativeId").notNull().references(() => creative.id),
  weight: integer("weight").notNull().default(1),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// M3 — Events / Dashboard
export const event = sqliteTable("event", {
  id: text("id").primaryKey(),
  campaignId: text("campaignId").notNull().references(() => campaign.id),
  creativeId: text("creativeId").references(() => creative.id),
  surface: text("surface", { enum: ["ctv", "venue", "dooh", "pub", "mobile"] }).notNull(),
  eventType: text("eventType", { enum: ["impression", "completion", "click", "cost"] }).notNull(),
  value: real("value"),
  geo: text("geo", { mode: "json" }).$type<{lat?: number; lng?: number; blockId?: string; neighborhood?: string}>(),
  ts: integer("ts", { mode: "timestamp" }).notNull(),
}, (t) => ({
  campaignIdx: index("idx_event_campaign").on(t.campaignId),
  tsIdx: index("idx_event_ts").on(t.ts),
}));
