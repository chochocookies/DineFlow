import type { CapacitorConfig } from "@capacitor/cli";

// IMPORTANT: this app is a thin native wrapper around the deployed
// dineflow-frontend website, not a bundled static app. The frontend uses
// Next.js Server Components and server-side data fetching (menu prices,
// order status, WebSocket) that fundamentally need a live Node.js server —
// there's no meaningful "static export" of it to bundle offline. Capacitor
// fully supports this pattern (server.url) for exactly this reason: it's
// the same approach used to wrap any server-rendered web app natively.
//
// Before building, replace server.url below with your actual deployed
// frontend URL (must be HTTPS in production; cleartext HTTP only works for
// local development, see server.cleartext).
const config: CapacitorConfig = {
  appId: "app.dineflow.mobile",
  appName: "DineFlow",
  webDir: "www", // unused with server.url, but Capacitor requires it to exist
  server: {
    url: process.env.DINEFLOW_WEB_URL || "https://dineflow.example.com",
    cleartext: false,
  },
  backgroundColor: "#faf3e7",
  android: {
    backgroundColor: "#faf3e7",
  },
  ios: {
    backgroundColor: "#faf3e7",
  },
};

export default config;
