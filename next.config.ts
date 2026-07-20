import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @imgly/background-removal uses WASM and must stay client-side.
  serverExternalPackages: ["@imgly/background-removal"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/*.sqlite",
          "**/*.sqlite-shm",
          "**/*.sqlite-wal",
        ],
      };
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "inaturalist-open-data.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "static.inaturalist.org",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
