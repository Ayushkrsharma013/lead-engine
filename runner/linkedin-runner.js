// runner/linkedin-runner.js
// Local LinkedIn outreach runner — runs on your home machine.
// Polls the linkedin_queue table and executes actions via Playwright.
// Never run this on a server — home IP only.

require("dotenv").config();
const path = require("path");
const os = require("os");

const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[runner] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Config — loaded from Supabase knowledge_store on startup (overrides .env)
let MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS_PER_DAY ?? "10", 10);
let MAX_DMS = parseInt(process.env.MAX_DMS_PER_DAY ?? "20", 10);
let MIN_DELAY = parseInt(process.env.MIN_DELAY_SECONDS ?? "30", 10) * 1000;
let MAX_DELAY = parseInt(process.env.MAX_DELAY_SECONDS ?? "120", 10) * 1000;
let ACTIVE_START = parseInt(process.env.ACTIVE_HOURS_START ?? "8", 10);
let ACTIVE_END = parseInt(process.env.ACTIVE_HOURS_END ?? "20", 10);
let BREAK_EVERY = parseInt(process.env.BREAK_EVERY_N_ACTIONS ?? "5", 10);
let BREAK_DURATION = parseInt(process.env.BREAK_DURATION_MINUTES ?? "15", 10) * 60 * 1000;

async function loadCloudConfig() {
  try {
    const { data } = await supabase
      .from("knowledge_store")
      .select("value")
      .eq("key", "runner.config")
      .maybeSingle();

    if (!data?.value || typeof data.value !== "object") return;
    const c = data.value;
    if (c.maxConnectionsPerDay) MAX_CONNECTIONS = c.maxConnectionsPerDay;
    if (c.maxDmsPerDay)         MAX_DMS         = c.maxDmsPerDay;
    if (c.minDelaySeconds)      MIN_DELAY       = c.minDelaySeconds * 1000;
    if (c.maxDelaySeconds)      MAX_DELAY       = c.maxDelaySeconds * 1000;
    if (c.activeHoursStart)     ACTIVE_START    = c.activeHoursStart;
    if (c.activeHoursEnd)       ACTIVE_END      = c.activeHoursEnd;
    if (c.breakEveryNActions)   BREAK_EVERY     = c.breakEveryNActions;
    if (c.breakDurationMinutes) BREAK_DURATION  = c.breakDurationMinutes * 60 * 1000;

    console.log(`[runner] Cloud config loaded — connections: ${MAX_CONNECTIONS}/day, DMs: ${MAX_DMS}/day, hours: ${ACTIVE_START}-${ACTIVE_END}`);
  } catch (e) {
    console.warn("[runner] Could not load cloud config, using .env defaults:", e.message);
  }
}

const POLL_INTERVAL = 5 * 60 * 1000;
const PROFILE_DIR = path.join(os.homedir(), ".linkedin-runner", "profile");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function isActiveHour() {
  const h = new Date().getHours();
  return h >= ACTIVE_START && h < ACTIVE_END;
}

async function getTodayStats() {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("linkedin_daily_stats")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  return {
    date: today,
    connections_sent: data?.connections_sent ?? 0,
    dms_sent: data?.dms_sent ?? 0,
    profile_views: data?.profile_views ?? 0,
  };
}

async function incrementStat(field) {
  const today = new Date().toISOString().split("T")[0];
  const current = await getTodayStats();
  await supabase.from("linkedin_daily_stats").upsert({
    date: today,
    connections_sent: field === "connections_sent" ? current.connections_sent + 1 : current.connections_sent,
    dms_sent: field === "dms_sent" ? current.dms_sent + 1 : current.dms_sent,
    profile_views: field === "profile_views" ? current.profile_views + 1 : current.profile_views,
    last_run_at: new Date().toISOString(),
  });
}

async function heartbeat() {
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("linkedin_daily_stats").upsert(
    { date: today, last_run_at: new Date().toISOString() },
    { onConflict: "date", ignoreDuplicates: false }
  );
}

async function getNextPendingAction() {
  const { data } = await supabase
    .from("linkedin_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function markExecuting(id) {
  await supabase.from("linkedin_queue").update({ status: "executing" }).eq("id", id);
}

async function markDone(id) {
  await supabase.from("linkedin_queue").update({
    status: "done",
    executed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function markFailed(id, error) {
  await supabase.from("linkedin_queue").update({
    status: "failed",
    error: String(error).slice(0, 500),
    executed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function logActivity(leadId, text) {
  await supabase.from("activity_log").insert({
    type: "notification",
    text,
    lead_id: leadId || null,
  });
}

async function updateLeadStatus(leadId, status, kanbanColumn) {
  await supabase.from("leads").update({
    status,
    kanban_column: kanbanColumn,
    last_touched: new Date().toISOString(),
  }).eq("id", leadId);
}

async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `[LinkedIn Runner] ${message}` }),
  }).catch(() => undefined);
}

// ─── Setup mode ───────────────────────────────────────────────────────────────

async function setupProfile() {
  console.log("[runner] Setup mode — opening Chrome for manual LinkedIn login...");
  console.log(`[runner] Profile will be saved to: ${PROFILE_DIR}`);
  console.log("[runner] Log into LinkedIn, then close the browser window.");

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await browser.newPage();
  await page.goto("https://www.linkedin.com/login");
  console.log("[runner] Browser opened. Log in and close the window when done.");

  await browser.waitForEvent("close").catch(() => undefined);
  console.log("[runner] Profile saved. Run `node linkedin-runner.js` to start the runner.");
  process.exit(0);
}

// ─── LinkedIn action execution ────────────────────────────────────────────────

async function executeConnectionRequest(page, action) {
  console.log(`[runner] Navigating to: ${action.linkedin_profile_url}`);
  await page.goto(action.linkedin_profile_url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const url = page.url();
  if (url.includes("checkpoint") || url.includes("challenge") || url.includes("captcha")) {
    throw new Error("CAPTCHA_DETECTED");
  }

  await randomDelay(5000, 15000);

  const messageBtn = page.locator("button:has-text('Message')");
  if (await messageBtn.count() > 0) {
    console.log("[runner] Already connected — skipping");
    return "already_connected";
  }

  const pendingBtn = page.locator("button:has-text('Pending')");
  if (await pendingBtn.count() > 0) {
    console.log("[runner] Connection already pending — skipping");
    return "already_pending";
  }

  const connectBtn = page.locator("button:has-text('Connect')").first();
  if (await connectBtn.count() === 0) {
    const moreBtn = page.locator("button:has-text('More')").first();
    if (await moreBtn.count() > 0) {
      await moreBtn.click();
      await randomDelay(800, 1500);
    }
    const connectInMenu = page.locator("[aria-label*='Connect']").first();
    if (await connectInMenu.count() === 0) {
      throw new Error("Connect button not found");
    }
    await connectInMenu.click();
  } else {
    const box = await connectBtn.boundingBox();
    if (box) {
      await page.mouse.move(
        box.x + box.width * 0.3 + Math.random() * box.width * 0.4,
        box.y + box.height * 0.3 + Math.random() * box.height * 0.4
      );
      await randomDelay(300, 800);
    }
    await connectBtn.click();
  }

  await randomDelay(1000, 2000);

  if (action.message) {
    const addNoteBtn = page.locator("button:has-text('Add a note')");
    if (await addNoteBtn.count() > 0) {
      await addNoteBtn.click();
      await randomDelay(500, 1000);

      const textarea = page.locator("textarea[name='message']");
      if (await textarea.count() > 0) {
        for (const char of action.message.slice(0, 300)) {
          await textarea.type(char, { delay: 80 + Math.random() * 80 });
        }
        await randomDelay(500, 1200);
      }
    }
  }

  const sendBtn = page.locator("button:has-text('Send')").first();
  if (await sendBtn.count() > 0) {
    await sendBtn.click();
    console.log(`[runner] Connection request sent`);
    return "sent";
  }

  throw new Error("Send button not found after adding note");
}

async function executeDM(page, action) {
  console.log(`[runner] Navigating to: ${action.linkedin_profile_url}`);
  await page.goto(action.linkedin_profile_url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const url = page.url();
  if (url.includes("checkpoint") || url.includes("challenge")) {
    throw new Error("CAPTCHA_DETECTED");
  }

  await randomDelay(5000, 12000);

  const messageBtn = page.locator("button:has-text('Message')").first();
  if (await messageBtn.count() === 0) {
    throw new Error("Message button not found — not connected yet?");
  }

  await messageBtn.click();
  await randomDelay(1500, 3000);

  const msgInput = page.locator(".msg-form__contenteditable, div[role='textbox']").first();
  if (await msgInput.count() === 0) {
    throw new Error("Message input not found");
  }

  const msgText = action.message ?? "Hi, I wanted to follow up with you.";
  for (const char of msgText.slice(0, 500)) {
    await msgInput.type(char, { delay: 80 + Math.random() * 80 });
  }

  await randomDelay(800, 2000);

  const submitBtn = page.locator("button[type='submit']").first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
    console.log(`[runner] DM sent`);
    return "sent";
  }

  throw new Error("Submit button not found in message dialog");
}

// ─── Main run loop ────────────────────────────────────────────────────────────

async function resetStuckExecuting() {
  // Reset any rows stuck in "executing" (e.g. from a previous crash) back to "pending"
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // older than 10 min
  const { error } = await supabase
    .from("linkedin_queue")
    .update({ status: "pending" })
    .eq("status", "executing")
    .lt("updated_at", cutoff);
  if (error) {
    // updated_at may not exist on all deployments — fall back to resetting all executing rows
    await supabase
      .from("linkedin_queue")
      .update({ status: "pending" })
      .eq("status", "executing");
  }
}

async function runOnce() {
  await resetStuckExecuting();

  const stats = await getTodayStats();

  if (!isActiveHour()) {
    console.log(`[runner] Outside active hours (${ACTIVE_START}:00–${ACTIVE_END}:00) — waiting`);
    return 0;
  }

  await heartbeat();

  const action = await getNextPendingAction();
  if (!action) {
    console.log("[runner] Queue empty — nothing to do");
    return 0;
  }

  if (action.action_type === "connection_request" && stats.connections_sent >= MAX_CONNECTIONS) {
    console.log(`[runner] Connection cap reached (${MAX_CONNECTIONS}/day) — waiting until tomorrow`);
    return 0;
  }
  if ((action.action_type === "dm" || action.action_type === "follow_up") && stats.dms_sent >= MAX_DMS) {
    console.log(`[runner] DM cap reached (${MAX_DMS}/day) — waiting until tomorrow`);
    return 0;
  }

  await markExecuting(action.id);
  console.log(`[runner] Executing ${action.action_type} for lead ${action.lead_id}`);

  let browser;
  try {
    browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      args: ["--start-minimized"],
    });

    const page = await browser.newPage();

    let result;
    if (action.action_type === "connection_request") {
      result = await executeConnectionRequest(page, action);
      if (result === "sent") {
        await incrementStat("connections_sent");
        await updateLeadStatus(action.lead_id, "contacted", "Contacted");
        await logActivity(action.lead_id, `Sent LinkedIn connection request`);
      }
    } else if (action.action_type === "dm" || action.action_type === "follow_up") {
      result = await executeDM(page, action);
      if (result === "sent") {
        await incrementStat("dms_sent");
        await logActivity(action.lead_id, `Sent LinkedIn DM`);
      }
    }

    await markDone(action.id);
    console.log(`[runner] Done — ${action.action_type} result: ${result}`);
    return 1;
  } catch (err) {
    const msg = String(err?.message ?? err);
    console.error(`[runner] Failed: ${msg}`);
    await markFailed(action.id, msg);

    if (msg === "CAPTCHA_DETECTED") {
      const alert = "CAPTCHA detected on LinkedIn — runner stopped. Please log in manually and restart.";
      console.error(`[runner] ${alert}`);
      await sendTelegramAlert(alert);
      process.exit(1);
    }
    return 0;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  if (process.argv.includes("--setup")) {
    await setupProfile();
    return;
  }

  // Load cloud config first — overrides .env values with UI-saved settings
  await loadCloudConfig();

  console.log(`[runner] LinkedIn Runner started`);
  console.log(`[runner] Limits: ${MAX_CONNECTIONS} connections/day · ${MAX_DMS} DMs/day`);
  console.log(`[runner] Active hours: ${ACTIVE_START}:00–${ACTIVE_END}:00`);
  console.log(`[runner] Profile: ${PROFILE_DIR}`);
  console.log(`[runner] Poll interval: ${POLL_INTERVAL / 1000}s\n`);

  let actionsSinceBreak = 0;

  while (true) {
    try {
      const executed = await runOnce();
      if (executed > 0) {
        actionsSinceBreak++;
        if (actionsSinceBreak >= BREAK_EVERY) {
          console.log(`[runner] ${BREAK_EVERY} actions done — taking ${BREAK_DURATION / 60000} min break`);
          actionsSinceBreak = 0;
          await new Promise(r => setTimeout(r, BREAK_DURATION));
        } else {
          await randomDelay(MIN_DELAY, MAX_DELAY);
        }
      } else {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    } catch (err) {
      console.error(`[runner] Unhandled error: ${err?.message ?? err}`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }
}

main().catch(err => {
  console.error("[runner] Fatal:", err);
  process.exit(1);
});
