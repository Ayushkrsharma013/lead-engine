import { formatINR } from "./currency";

export interface InlineButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboard = InlineButton[][];

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  return { token, chatId, base: token ? `https://api.telegram.org/bot${token}` : "" };
}

export function isConfigured(): boolean {
  const { token, chatId } = getConfig();
  return !!(token && chatId);
}

export async function tgSend(
  text: string,
  keyboard?: InlineKeyboard,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<number | null> {
  const { token, chatId, base } = getConfig();
  if (!token || !chatId) return null;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };
  if (keyboard && keyboard.length > 0) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  const res = await fetch(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string };
  if (!data.ok) {
    console.error("[TelegramBot] sendMessage error:", JSON.stringify(data));
    return null;
  }
  return data.result?.message_id ?? null;
}

export async function tgEdit(
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  const { token, chatId, base } = getConfig();
  if (!token || !chatId) return;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  body.reply_markup = keyboard && keyboard.length > 0
    ? { inline_keyboard: keyboard }
    : { inline_keyboard: [] };

  await fetch(`${base}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function tgAnswerCallback(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const { token, base } = getConfig();
  if (!token) return;

  await fetch(`${base}/answerCallbackQuery`, {
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
  return formatINR(amount);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
