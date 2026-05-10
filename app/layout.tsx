import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/AppContext";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "LinkedIn ProOS",
  description: "AI-powered B2B prospecting platform for LinkedIn + Email outreach",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-bg text-ink font-geist">
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
