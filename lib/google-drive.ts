/**
 * Client-side Google Drive integration using Google Identity Services (GIS).
 *
 * Setup required (one-time, by the user):
 *   1. Go to https://console.cloud.google.com/
 *   2. Create a project → Enable "Google Drive API"
 *   3. Create credentials → OAuth 2.0 Client ID (Web application)
 *   4. Add your domain to "Authorized JavaScript origins"
 *      e.g. https://your-app.vercel.app  and  http://localhost:3000
 *   5. Paste the Client ID into the LeadGen Engine settings modal
 */

const CLIENT_ID_KEY = "leadgen_gdrive_client_id";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

// Minimal type stubs for Google Identity Services (loaded dynamically at runtime)
interface GISTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface GISTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}
interface GISAPI {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (resp: GISTokenResponse) => void;
      }): GISTokenClient;
      revoke(token: string, callback?: () => void): void;
    };
  };
}

// Safe accessor — avoids `declare const google` type issues
function gis(): GISAPI | undefined {
  if (typeof window === "undefined") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as Record<string, unknown>).google as GISAPI | undefined;
}

let gisLoaded = false;
let cachedToken: string | null = null;
let tokenExpiry = 0;

// ─── Config ───────────────────────────────────────────────────────────────────
export function getGDriveClientId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CLIENT_ID_KEY) ?? "";
}

export function setGDriveClientId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
  cachedToken = null;
  tokenExpiry = 0;
}

// ─── Load GIS script ──────────────────────────────────────────────────────────
async function loadGIS(): Promise<void> {
  if (gisLoaded && gis()) return;

  return new Promise((resolve, reject) => {
    // If script is already in DOM, wait for it
    const existing = document.getElementById("gis-script");
    if (existing) {
      if (gis()) { gisLoaded = true; resolve(); return; }
      existing.addEventListener("load", () => { gisLoaded = true; resolve(); });
      existing.addEventListener("error", () => reject(new Error("GIS script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function getGDriveAccessToken(clientId: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  await loadGIS();
  const g = gis();
  if (!g) throw new Error("Google Identity Services failed to load");

  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: GISTokenResponse) => {
        if (resp.error) {
          reject(new Error(resp.error_description ?? resp.error));
        } else if (resp.access_token) {
          cachedToken = resp.access_token;
          tokenExpiry = Date.now() + 3_600_000; // 1 h
          resolve(resp.access_token);
        } else {
          reject(new Error("No access token received from Google"));
        }
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export function revokeGDriveToken(): void {
  const g = gis();
  if (cachedToken && g) {
    g.accounts.oauth2.revoke(cachedToken);
  }
  cachedToken = null;
  tokenExpiry = 0;
}

// ─── Upload CSV to Google Drive ───────────────────────────────────────────────
export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  viewUrl: string;
}

export async function uploadCSVToDrive(
  csvContent: string,
  fileName: string,
  clientId: string
): Promise<DriveUploadResult> {
  const token = await getGDriveAccessToken(clientId);
  const boundary = "LeadEngineBoundary" + Date.now().toString(36);

  const metadata = JSON.stringify({ name: fileName, mimeType: "text/csv" });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: text/csv; charset=UTF-8",
    "",
    csvContent,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Upload failed (HTTP ${res.status})`);
  }

  const data = await res.json() as { id: string; name: string };
  return {
    fileId: data.id,
    fileName: data.name,
    viewUrl: `https://drive.google.com/file/d/${data.id}/view`,
  };
}
