"use client";

import { createContext, useContext } from "react";
import type { StoredAuth } from "./auth";

const AuthContext = createContext<StoredAuth | null>(null);

export const AuthProvider = AuthContext.Provider;

// Only used inside a tree that a layout has already confirmed is
// authenticated (see app/admin/(dashboard)/layout.tsx) — throwing here
// means that guarantee was broken somewhere, which is a bug worth surfacing
// loudly rather than silently rendering with a null token.
export function useAuth(): StoredAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() called outside an authenticated route");
  }
  return ctx;
}
