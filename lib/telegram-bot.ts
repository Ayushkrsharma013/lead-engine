const token = process.env.TELEGRAM_BOT_TOKEN || "";
const BASE = token ? `https://api.telegram.org/bot${token}` : "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export interface InlineButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboard = InlineButton[][];

export function isConfigured(): boolean {
  return !!(token && CHAT_ID);
}

export async function tgSend(
  text: string,
  keyboard?: InlineKeyboard,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<number | null> {
  if (!isConfigured()) return null;

  const body: Record<string, unknown> = {
    chat_id: CHAT_ID,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };
  if (keyboard && keyboard.length > 0) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
  if (!data.ok) {
    console.error("[TelegramBot] sendMessage error:", data);
    return null;
  }
  return data.result?.message_id ?? null;
}

export async function tgEdit(
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  if (!isConfigured()) return;

  const body: Record<string, unknown> = {
    chat_id: CHAT_ID,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  body.reply_markup = keyboard && keyboard.length > 0
    ? { inline_keyboard: keyboard }
    : { inline_keyboard: [] };

  await fetch(`${BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function tgAnswerCallback(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  if (!isConfigured()) return;

  await fetch(`${BASE}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text ?? "",
      show_alert: false,
    }),
  });
}

export function fmt(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
