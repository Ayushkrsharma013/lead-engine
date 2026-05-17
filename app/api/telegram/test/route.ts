import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  // Explicitly opt out of Next.js fetch cache for this entire request
  noStore();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const result: Record<string, unknown> = {
    lambda_ran_at: new Date().toISOString(),
    token_set: !!token,
    token_preview: token ? `${token.slice(0, 10)}...${token.slice(-4)}` : null,
    chat_id_set: !!chatId,
    chat_id_value: chatId ?? null,
  };

  if (!token) {
    return NextResponse.json({ ...result, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  // Verify token via getMe — explicit no-store on each fetch
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    });
    const meData = (await meRes.json()) as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };
    result.get_me_ok = meData.ok;
    result.bot_username = meData.result?.username ?? null;
    result.bot_name = meData.result?.first_name ?? null;
    if (!meData.ok) {
      result.get_me_error = meData.description ?? "unknown";
      return NextResponse.json({ ...result, error: "Token is invalid — getMe failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
  } catch (err) {
    result.get_me_exception = String(err);
    return NextResponse.json({ ...result, error: "Network error calling Telegram API" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  if (!chatId) {
    return NextResponse.json({ ...result, error: "TELEGRAM_CHAT_ID is not set" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  // Send test message — explicit no-store
  try {
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ <b>Telegram test from Prospecting OS</b>\n\nThis is a diagnostic message sent at ${new Date().toISOString()}. If you see this, notifications are working.`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const sendData = (await sendRes.json()) as { ok: boolean; result?: { message_id?: number }; description?: string; error_code?: number };
    result.send_ok = sendData.ok;
    result.message_id = sendData.result?.message_id ?? null;
    if (!sendData.ok) {
      result.send_error = sendData.description ?? "unknown";
      result.send_error_code = sendData.error_code ?? null;
    }
  } catch (err) {
    result.send_exception = String(err);
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
