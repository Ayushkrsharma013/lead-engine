import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import { AppProvider } from "@/lib/AppContext";
import { Shell } from "@/components/Shell";
import { ContextProviders } from "@/lib/context/Providers";
import JsonLd from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import CookieConsent from "@/components/analytics/CookieConsent";

const basePath = "/prospecting-os";

export const metadata: Metadata = {
  title: "Prospecting OS — AI-Powered B2B Lead Generation System | 500+ Scored Leads/Month",
  description:
    "Prospecting OS automates B2B lead generation using Apify scrapers + Anthropic Claude AI. Get 500+ scored, enriched leads per month delivered to Slack or Telegram. Used by agencies, SaaS founders, and consultants worldwide.",
  keywords: [
    "AI lead generation",
    "B2B prospecting automation",
    "AI SDR alternative",
    "Apify lead scraping",
    "automated cold outreach",
    "Claude AI lead scoring",
    "Supabase-powered dashboard",
    "replace SDR with AI",
  ],
  openGraph: {
    title: "Prospecting OS — AI B2B Lead Generation. 500+ Scored Leads/Month.",
    description:
      "Stop doing manual prospecting. Let AI find, score, and deliver your ideal clients every morning. Built on Apify + Anthropic Claude AI + Supabase.",
    url: "https://app.flow-forges.com/prospecting-os",
    siteName: "Prospecting OS by Flow-Forges",
    images: [
      {
        url: "https://app.flow-forges.com/prospecting-os/assets/og-image.png",
        width: 1200,
        height: 630,
        alt: "Prospecting OS — AI-powered B2B lead generation pipeline showing scored leads delivered via Slack",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prospecting OS — AI B2B Lead Generation System",
    description:
      "500+ scored B2B leads/month. Zero manual research. Powered by Apify lead scraping and Anthropic Claude AI. Built for agencies, SaaS & consultants.",
    images: ["https://app.flow-forges.com/prospecting-os/assets/og-image.png"],
  },
  alternates: {
    canonical: "https://app.flow-forges.com/prospecting-os",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: `${basePath}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
      { url: `${basePath}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${basePath}/favicon.ico`, sizes: "48x48" },
    ],
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    other: [
      { url: `${basePath}/android-chrome-192x192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/android-chrome-512x512.png`, sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: `${basePath}/site.webmanifest`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800,900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-bg text-ink font-geist">
        <JsonLd id="schema-organization" data={organizationSchema()} />
        <JsonLd id="schema-website" data={websiteSchema()} />
        <ContextProviders>
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </ContextProviders>
        <AnalyticsProvider />
        <CookieConsent />
      </body>
    </html>
  );
}
