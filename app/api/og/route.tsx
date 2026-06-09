import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title") || "Prospecting OS — AI-Powered B2B Lead Generation";
    const subtitle = searchParams.get("subtitle") || "500+ Scored Leads/Month. Zero Manual Research.";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0e0d0a 0%, #1a1917 50%, #0e0d0a 100%)",
            padding: "80px 100px",
            fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #E8A840, #e8420a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
                color: "#0e0d0a",
              }}
            >
              P
            </div>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#7a7875",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Flow-Forges
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#f5f4f1",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: 16,
              maxWidth: "85%",
            }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 24,
              color: "#b0aeaa",
              lineHeight: 1.4,
              maxWidth: "75%",
            }}
          >
            {subtitle}
          </p>

          {/* Bottom accent bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #E8A840, #e8420a)",
            }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
