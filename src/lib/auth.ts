import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30d
    updateAge: 60 * 60 * 24,       // refresh daily
  },
  user: {
    additionalFields: {},
  },
  trustedOrigins: [
    "https://app.we-are-glo.com",
    "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
