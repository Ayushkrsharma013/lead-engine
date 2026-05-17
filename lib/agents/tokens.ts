// lib/agents/tokens.ts
import { createHmac } from "crypto";

export function generateApproveToken(actionId: string): string {
  const secret = process.env.CRON_SECRET ?? "dev-secret";
  return createHmac("sha256", secret).update(actionId).digest("hex").slice(0, 32);
}

export function verifyApproveToken(actionId: string, token: string): boolean {
  return token === generateApproveToken(actionId);
}
