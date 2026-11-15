import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Phones on the same Wi-Fi open the dev server by the laptop's LAN IP
  // (see `npm run dev:lan`). Private address ranges only.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.trycloudflare.com", "*.ngrok-free.app"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
