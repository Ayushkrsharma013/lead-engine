import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const result: Record<string, unknown> = {
    token_set: !!token,
    token_preview: token ? `${token.slice(0, 10)}...${token.slice(-4)}` : null,
    chat_id_set: !!chatId,
    chat_id_value: chatId ?? null,
  };

  if (!token) {
    return NextResponse.json({ ...result, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 400 });
  }

  // Verify token via getMe
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = (await meRes.json()) as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };
    result.get_me_ok = meData.ok;
    result.bot_username = meData.result?.username ?? null;
    result.bot_name = meData.result?.first_name ?? null;
    if (!meData.ok) {
      result.get_me_error = meData.description ?? "unknown";
      return NextResponse.json({ ...result, error: "Token is invalid — getMe failed" }, { status: 400 });
    }
  } catch (err) {
    result.get_me_exception = String(err);
    return NextResponse.json({ ...result, error: "Network error calling Telegram API" }, { status: 500 });
  }

  if (!chatId) {
    return NextResponse.json({ ...result, error: "TELEGRAM_CHAT_ID is not set" }, { status: 400 });
  }

  // Attempt to send a test message
  try {
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ <b>Telegram test from Prospecting OS</b>\n\nThis is a diagnostic message. If you see this, notifications are working.",
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

  return NextResponse.json(result);
}
