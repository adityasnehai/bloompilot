export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "BloomPilot",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ??
    "The AI operating system for modern home gardening.",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
    "BloomPilot helps gardeners onboard their space, organize plant care, and prepare for an AI agent-powered care flow.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hello@bloompilot.app",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "bloompilot_session",
  gardenCookieName: process.env.GARDEN_COOKIE_NAME ?? "bloompilot_garden",
  strictProductionMode: process.env.STRICT_PRODUCTION_MODE !== "false",
} as const;
