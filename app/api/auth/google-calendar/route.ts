import { NextResponse } from "next/server";
import { getGoogleCalendarAuthUrl } from "@/lib/google-calendar";

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function GET() {
  const redirectUri = `${getBaseUrl()}/prospecting-os/api/auth/google-calendar/callback`;
  const authUrl = getGoogleCalendarAuthUrl(redirectUri);

  if (!authUrl) {
    return NextResponse.json(
      {
        error: "Missing GOOGLE_CLIENT_ID env var. Set it in your Vercel project settings.",
        setup: [
          "1. Go to https://console.cloud.google.com/",
          "2. Create a project → Enable Google Calendar API",
          "3. Create OAuth 2.0 Client ID → Web application",
          "4. Add redirect URI: " + redirectUri,
          "5. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel env vars",
        ],
      },
      { status: 400 }
    );
  }

  return NextResponse.redirect(authUrl);
}
