import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

// Only wraps the build with Sentry's webpack plugin (source-map upload) when an
// auth token is actually configured — with nothing set, this exports nextConfig
// unchanged, so the build behaves identically to before Sentry was added.
// Error tracking at runtime (Sentry.init in the instrumentation files) only needs
// SENTRY_DSN and works independently of this.
export default process.env.SENTRY_AUTH_TOKEN?.trim()
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: false,
      disableLogger: true,
    })
  : nextConfig;
