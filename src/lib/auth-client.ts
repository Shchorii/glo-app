"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "https://app.we-are-glo.com",
});

export const { signIn, signUp, signOut, useSession } = authClient;
