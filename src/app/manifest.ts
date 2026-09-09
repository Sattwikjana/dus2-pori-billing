import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dus2 PORI — Billing & Loyalty",
    short_name: "Dus2 PORI",
    description:
      "Billing, inventory and loyalty points for the Dus2 PORI cosmetics store.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eff3",
    theme_color: "#2a0e21",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
