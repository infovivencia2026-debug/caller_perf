import type { MetadataRoute } from "next";

/**
 * Makes the app installable on a phone: "Add to home screen" gives it its own icon and
 * launches it without browser chrome, which is most of what a counsellor wants from an
 * app. `start_url` goes to the calling screen rather than the dashboard, since that is
 * where a shift begins.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Counsellor Performance",
    short_name: "Counsellor",
    description: "Call logging and performance tracking for counsellors",
    start_url: "/caller/call",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef0f6",
    theme_color: "#4f46e5",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
