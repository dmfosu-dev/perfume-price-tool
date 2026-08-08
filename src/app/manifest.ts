import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aromatic Ghana — Price Tool",
    short_name: "Aromatic",
    description: "Source prices and stock for the Aromatic Ghana perfume catalogue.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    // Static files rather than the old generated route: the mark is now a
    // binary asset, so rendering it per request bought nothing and meant the
    // icon depended on a running server. The maskable copy is a separate file
    // because Android crops to a circle and needs the extra safe-zone padding.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
