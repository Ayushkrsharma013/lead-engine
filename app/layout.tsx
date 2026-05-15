import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import { AppProvider } from "@/lib/AppContext";
import { Shell } from "@/components/Shell";

const basePath = "/prospecting-os";

export const metadata: Metadata = {
  title: "Prospecting OS — AI-Powered B2B Prospecting Engine",
  description: "500+ qualified leads/month. Zero manual research. One AI system that finds, scores, and delivers your ideal clients — while you sleep.",
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
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
