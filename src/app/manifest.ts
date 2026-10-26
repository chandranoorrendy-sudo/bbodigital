import type { MetadataRoute } from "next";

// Manifest dasar; ikon kuttab dan service worker (Serwist) menyusul di Tahap 6.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BBO Digital Kuttab Imam Al-Ghazali",
    short_name: "BBO Kuttab",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfdfb",
    theme_color: "#14532d",
    lang: "id",
  };
}
