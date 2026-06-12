/**
 * Reliable webhook sender with exponential backoff retry.
 * Replaces the .catch(() => undefined) fire-and-forget pattern
 * used across 8+ routes for n8n/Telegram notifications.
 */
export async function fireWebhook(
  url: string,
  body: Record<string, unknown>,
  options?: { retries?: number; timeoutMs?: number; label?: string }
): Promise<void> {
  const { retries = 3, timeoutMs = 8000, label = url } = options ?? {};

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return;
      console.warn(
        `[webhook] ${label} returned ${res.status} (attempt ${attempt + 1}/${retries})`
      );
    } catch (err) {
      if (attempt === retries - 1) {
        console.error(`[webhook] ${label} failed after ${retries} attempts:`, err);
        return; // Don't throw — webhook failure should not break the main request
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}
