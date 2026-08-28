import type { StaffPublic } from "./types";

export interface StoredAuth {
  token: string;
  staff: StaffPublic;
}

const KEY = "dineflow:staff";

// /kitchen and /admin intentionally share this one key — logging in on
// either page authenticates both, since in practice it's the same staff
// session on the same device either way.
export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  window.localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  window.localStorage.removeItem(KEY);
}
