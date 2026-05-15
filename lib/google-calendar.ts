/**
 * Server-side Google Calendar integration.
 *
 * Prerequisites (one-time setup):
 *   1. Go to https://console.cloud.google.com/
 *   2. Create a project → Enable "Google Calendar API"
 *   3. Create credentials → OAuth 2.0 Client ID → Web application
 *   4. Add your domain to "Authorized redirect URIs":
 *      https://your-app.vercel.app/api/auth/google-calendar/callback
 *      http://localhost:3000/api/auth/google-calendar/callback
 *   5. Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   6. Visit /api/auth/google-calendar to connect and get your refresh token
 *   7. Set GOOGLE_CALENDAR_REFRESH_TOKEN env var
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendars.readonly",
].join(" ");

function getEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || "",
  };
}

// ─── OAuth URL Generation ─────────────────────────────────────────────────

export function getGoogleCalendarAuthUrl(redirectUri: string): string | null {
  const { clientId } = getEnv();
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ─── Token Exchange ───────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ refreshToken?: string; error?: string }> {
  const { clientId, clientSecret } = getEnv();
  if (!clientId || !clientSecret) {
    return { error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars" };
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return { error: (data.error_description as string) || (data.error as string) || "Token exchange failed" };
  }

  return { refreshToken: data.refresh_token as string | undefined };
}

// ─── Access Token ─────────────────────────────────────────────────────────

let cachedAccessToken: string | null = null;
let accessTokenExpiry = 0;

export async function getAccessToken(): Promise<string | null> {
  const { clientId, clientSecret, refreshToken } = getEnv();
  if (!clientId || !clientSecret || !refreshToken) return null;

  if (cachedAccessToken && Date.now() < accessTokenExpiry - 60_000) {
    return cachedAccessToken;
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error("[google-calendar] token refresh failed:", data.error);
    return null;
  }

  cachedAccessToken = data.access_token as string;
  accessTokenExpiry = Date.now() + ((data.expires_in as number) || 3600) * 1000;
  return cachedAccessToken;
}

// ─── Calendar Event Creation ──────────────────────────────────────────────

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM" (24h)
  endTime?: string;  // defaults to startTime + 30 min
  attendees?: { email: string; displayName?: string }[];
  location?: string;
  timezone?: string; // IANA timezone, e.g. "Asia/Kolkata"
}

export interface CalendarEventResult {
  htmlLink?: string;
  error?: string;
}

export async function createCalendarEvent(
  event: CalendarEventInput
): Promise<CalendarEventResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { error: "Google Calendar not connected — set GOOGLE_CALENDAR_REFRESH_TOKEN" };
  }

  // Parse start/end as local datetimes
  const [startH, startM] = event.startTime.split(":").map(Number);
  const endH = event.endTime ? Number(event.endTime.split(":")[0]) : startH;
  const endM = event.endTime ? Number(event.endTime.split(":")[1]) : startM + 30;
  const endMinutes = endH * 60 + endM;
  const endHr = Math.floor((endMinutes > startH * 60 + startM ? endMinutes : startH * 60 + startM + 30) / 60);
  const endMr = ((endMinutes > startH * 60 + startM ? endMinutes : startH * 60 + startM + 30) % 60);

  const startDateTime = `${event.startDate}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00`;
  const endDateTime = `${event.startDate}T${String(endHr).padStart(2, "0")}:${String(endMr).padStart(2, "0")}:00`;

  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description || "",
    start: { dateTime: startDateTime, timeZone: event.timezone || "Asia/Kolkata" },
    end: { dateTime: endDateTime, timeZone: event.timezone || "Asia/Kolkata" },
    attendees: event.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName || "",
      responseStatus: "needsAction",
    })) || [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 30 },
      ],
    },
  };

  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      console.error("[google-calendar] event creation failed:", data.error);
      return { error: (data.error as { message?: string })?.message || `API error ${res.status}` };
    }

    return { htmlLink: data.htmlLink as string };
  } catch (err) {
    console.error("[google-calendar] unexpected error:", err);
    return { error: "Failed to reach Google Calendar API" };
  }
}

// ─── Connection Check ─────────────────────────────────────────────────────

export function isCalendarConnected(): boolean {
  const { clientId, clientSecret, refreshToken } = getEnv();
  return Boolean(clientId && clientSecret && refreshToken);
}
