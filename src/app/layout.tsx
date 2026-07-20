import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "./globals.css";
import { appConfig } from "@/lib/app-config";
import { MantineAppProvider } from "@/components/providers/mantine-app-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.siteUrl),
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "plant care app",
    "gardening assistant",
    "AI gardening",
    "plant diagnosis",
    "weather based watering",
    "garden dashboard",
    "BloomPilot",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: appConfig.siteUrl,
    title: appConfig.name,
    description: appConfig.description,
    siteName: appConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: appConfig.name,
    description: appConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full scroll-smooth antialiased">
      <body className="min-h-full text-[var(--color-ink)]">
        <MantineAppProvider>
          {children}
          <Toaster />
        </MantineAppProvider>
      </body>
    </html>
  );
}
