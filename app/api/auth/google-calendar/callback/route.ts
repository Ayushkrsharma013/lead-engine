import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

function getBaseUrl() {
  // Prefer the stable custom domain over per-deploy Vercel URL
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Google Calendar — Error</title><meta name="color-scheme" content="dark"></head><body style="background:#0e0d0a;color:#f5f4f1;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:480px;text-align:center;padding:40px"><h1 style="color:#e8420a">Connection Failed</h1><p>Google returned an error: <code>${error}</code></p><p style="color:#7a7875;font-size:14px">You can close this page and try again.</p></div></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Google Calendar — Error</title><meta name="color-scheme" content="dark"></head><body style="background:#0e0d0a;color:#f5f4f1;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:480px;text-align:center;padding:40px"><h1 style="color:#e8420a">Missing Code</h1><p>No authorization code received from Google.</p><p style="color:#7a7875;font-size:14px">Please try connecting again.</p></div></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const redirectUri = `${getBaseUrl()}/prospecting-os/api/auth/google-calendar/callback`;
  const result = await exchangeCodeForTokens(code, redirectUri);

  if (result.error) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Google Calendar — Error</title><meta name="color-scheme" content="dark"></head><body style="background:#0e0d0a;color:#f5f4f1;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:480px;text-align:center;padding:40px"><h1 style="color:#e8420a">Token Exchange Failed</h1><p style="color:#b0aeaa">${result.error}</p><p style="color:#7a7875;font-size:14px">Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set correctly in your Vercel environment variables.</p></div></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  // Success — show the refresh token to copy
  return new NextResponse(
    `<!DOCTYPE html><html><head><title>Google Calendar — Connected</title><meta name="color-scheme" content="dark"><style>body{background:#0e0d0a;color:#f5f4f1;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{max-width:560px;width:100%;background:#1a1917;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;text-align:center}.success{width:48px;height:48px;border-radius:50%;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px}.token-box{background:#141310;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin:16px 0;font-family:monospace;font-size:13px;word-break:break-all;text-align:left;color:#22c55e;user-select:all}.steps{text-align:left;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.1);border-radius:12px;padding:16px;margin-top:20px}.steps ol{margin:0;padding-left:20px;color:#b0aeaa;font-size:14px;line-height:1.8}.steps code{background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:12px;color:#f5f4f1}</style></head><body><div class="card"><div class="success">✅</div><h1 style="margin:0 0 8px">Google Calendar Connected!</h1><p style="color:#b0aeaa;margin:0 0 4px">Copy this refresh token and add it to your Vercel environment variables:</p><p style="color:#7a7875;font-size:13px;margin:0 0 8px">The token is shown only once — save it now.</p><div class="token-box">${result.refreshToken}</div><div class="steps"><p style="color:#f5f4f1;font-weight:600;margin:0 0 8px;font-size:14px">Final step — add to Vercel:</p><ol><li>Go to your Vercel project → Settings → Environment Variables</li><li>Add key: <code>GOOGLE_CALENDAR_REFRESH_TOKEN</code></li><li>Paste the refresh token above as the value</li><li>Make sure <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> are also set</li><li>Redeploy your project</li></ol><p style="color:#7a7875;font-size:13px;margin:12px 0 0">Demo bookings will now automatically create events in your primary Google Calendar.</p></div></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
