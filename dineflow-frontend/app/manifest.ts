import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DineFlow",
    short_name: "DineFlow",
    description: "Scan. Order. Enjoy. — digital restaurant ordering platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf3e7",
    theme_color: "#c8401e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
