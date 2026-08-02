import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEXUS Chess",
    short_name: "NEXUS",
    description:
      "Competitive chess with ranked bots, live multiplayer, accurate rules, clocks, ratings, and Stockfish 18 analysis.",
    start_url: "/",
    display: "standalone",
    background_color: "#080a08",
    theme_color: "#c7f64b",
    orientation: "any",
    categories: ["games", "education", "sports"],
    icons: [
      {
        src: "/brand/nexus-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/brand/nexus-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
