import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadGen Engine",
  description: "AI-powered B2B lead generation for SaaS founders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080b10] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
