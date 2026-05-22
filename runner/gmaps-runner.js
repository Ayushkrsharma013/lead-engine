// runner/gmaps-runner.js
// Local GMap outreach runner — runs on your home machine (residential IP).
// Polls gmaps_outreach_queue every 5 min.
// contact_form_fill → Playwright navigates website, fills contact form.
// sms_follow_up    → Twilio REST API (no Playwright).
// Never run this on a server.

require("dotenv").config();
const path = require("path");
const os = require("os");

const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const twilio = require("twilio");

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || "ayush@flow-forges.com";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[gmaps-runner] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_FORM_FILLS = parseInt(process.env.MAX_FORM_FILLS_PER_DAY ?? "30", 10);
const MAX_SMS = parseInt(process.env.MAX_SMS_PER_DAY ?? "20", 10);
const ACTIVE_START = parseInt(process.env.ACTIVE_HOURS_START ?? "9", 10);
const ACTIVE_END = parseInt(process.env.ACTIVE_HOURS_END ?? "18", 10);

const POLL_INTERVAL = 5 * 60 * 1000;
const PROFILE_DIR = path.join(os.homedir(), ".gmaps-runner", "profile");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActiveHour() {
  const h = new Date().getHours();
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  return h >= ACTIVE_START && h < ACTIVE_END;
}

function randomDelay(minMs, maxMs) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

async function getTodayCounts() {
  const today = new Date().toISOString().split("T")[0];
  const { count: formsFilled } = await supabase
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "contact_form_fill")
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);
  const { count: smsSent } = await supabase
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "sms_follow_up")
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);
  return { formsFilled: formsFilled ?? 0, smsSent: smsSent ?? 0 };
}

async function markExecuting(id) {
  await supabase.from("gmaps_outreach_queue")
    .update({ status: "executing" }).eq("id", id);
}

async function markDone(id, logMessage) {
  await supabase.from("gmaps_outreach_queue").update({
    status: "done",
    executed_at: new Date().toISOString(),
    error: logMessage ?? null,
  }).eq("id", id);
}

async function markFailed(id, error) {
  await supabase.from("gmaps_outreach_queue").update({
    status: "failed",
    error: String(error).slice(0, 500),
    executed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function markSkipped(id, reason) {
  await supabase.from("gmaps_outreach_queue").update({
    status: "skipped",
    error: String(reason).slice(0, 200),
  }).eq("id", id);
}

async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `[GMap Runner] ${message}` }),
  }).catch(() => undefined);
}

async function logActivity(leadId, text) {
  await supabase.from("activity_log").insert({
    type: "notification",
    text,
    lead_id: leadId || null,
  });
}

async function resetStuckExecuting() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("gmaps_outreach_queue")
    .update({ status: "pending" })
    .eq("status", "executing")
    .lt("scheduled_for", tenMinutesAgo)
    .select("id");
  if (data?.length) {
    console.log(`[gmaps-runner] Reset ${data.length} stuck executing rows back to pending`);
  }
}

// ─── Contact Form Fill (Playwright) ──────────────────────────────────────────

async function fillContactForm(websiteUrl, message) {
  let browser;
  try {
    browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);

    await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    let formFound = await tryFillForm(page, message);

    if (!formFound) {
      const contactHref = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const link = links.find(l =>
          /\bcontact\b|get.in.touch/i.test(l.textContent + " " + l.href)
        );
        return link ? link.href : null;
      });

      if (contactHref && contactHref !== websiteUrl) {
        await page.goto(contactHref, { waitUntil: "domcontentloaded", timeout: 15000 });
        formFound = await tryFillForm(page, message);
      }
    }

    await browser.close();

    if (!formFound) return { success: false, error: "no_contact_form" };
    return { success: true };
  } catch (err) {
    if (browser) await browser.close().catch(() => undefined);
    return { success: false, error: err.message };
  }
}

async function tryFillForm(page, message) {
  const formSelectors = [
    'form[action*="contact"]',
    'form#contact',
    'form.contact-form',
    'form.wpcf7-form',
    'form[class*="contact"]',
  ];

  let form = null;
  for (const sel of formSelectors) {
    const el = await page.$(sel);
    if (el) { form = el; break; }
  }

  if (!form) {
    const textareas = await page.$$("textarea");
    for (const ta of textareas) {
      const parent = await ta.evaluateHandle(el => el.closest("form"));
      if (parent) { form = parent; break; }
    }
  }

  if (!form) return false;

  const nameInput = await form.$('input[name*="name"], input[placeholder*="name" i], input[id*="name" i]');
  if (nameInput) {
    await nameInput.click();
    await nameInput.fill("Ayush Kumar | Flow Forges");
  }

  const emailInput = await form.$('input[type="email"], input[name*="email" i], input[placeholder*="email" i]');
  if (emailInput) {
    await emailInput.click();
    await emailInput.fill(BUSINESS_EMAIL);
  }

  const textarea = await form.$("textarea");
  if (!textarea) return false;
  await textarea.click();
  for (const char of message) {
    await textarea.type(char, { delay: 80 + Math.random() * 40 });
  }

  const submitBtn = await form.$('button[type="submit"], input[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes("thank you") || text.includes("received") || text.includes("success");
  }, { timeout: 5000 }).catch(() => undefined);

  return true;
}

// ─── SMS Follow-up (Twilio) ───────────────────────────────────────────────────

async function sendSms(phone, message) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { success: false, error: "Twilio credentials not configured in .env" };
  }
  try {
    const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    const msg = await client.messages.create({
      body: message,
      from: TWILIO_FROM,
      to: phone,
    });
    return { success: true, sid: msg.sid };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Main poll cycle ──────────────────────────────────────────────────────────

async function writeHeartbeat() {
  try {
    await supabase.from("knowledge_store").upsert(
      {
        key: "gmaps_runner.heartbeat",
        value: { lastBeat: new Date().toISOString(), activeHours: isActiveHour() },
        agent: "gmaps-runner",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (e) {
    // silent — heartbeat is non-critical
  }
}

async function runOnce() {
  await writeHeartbeat();
  await resetStuckExecuting();

  if (!isActiveHour()) {
    console.log(`[gmaps-runner] Outside active hours (${ACTIVE_START}:00–${ACTIVE_END}:00, weekdays only) — skipping`);
    return;
  }

  const { formsFilled, smsSent } = await getTodayCounts();

  const { data: item } = await supabase
    .from("gmaps_outreach_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("step_number", { ascending: true })
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item) {
    console.log(`[gmaps-runner] No pending items — forms: ${formsFilled}/${MAX_FORM_FILLS}, SMS: ${smsSent}/${MAX_SMS}`);
    return;
  }

  if (item.action_type === "contact_form_fill" && formsFilled >= MAX_FORM_FILLS) {
    console.log(`[gmaps-runner] Daily form fill cap reached (${MAX_FORM_FILLS}) — skipping`);
    return;
  }
  if (item.action_type === "sms_follow_up" && smsSent >= MAX_SMS) {
    console.log(`[gmaps-runner] Daily SMS cap reached (${MAX_SMS}) — skipping`);
    return;
  }

  await markExecuting(item.id);
  console.log(`[gmaps-runner] Processing ${item.action_type} for lead ${item.lead_id}`);

  if (item.action_type === "contact_form_fill") {
    if (!item.website_url) {
      await markSkipped(item.id, "no_website_url");
      await logActivity(item.lead_id, "GMap outreach: skipped — no website URL");
      return;
    }

    const result = await fillContactForm(item.website_url, item.message);

    if (result.success) {
      await markDone(item.id, null);
      await logActivity(item.lead_id, `GMap outreach: contact form filled on ${item.website_url}`);
      await sendTelegramAlert(`Contact form sent to lead ${item.lead_id}`);
      console.log(`[gmaps-runner] Contact form filled for ${item.lead_id}`);
    } else if (result.error === "no_contact_form") {
      await markSkipped(item.id, "no_contact_form");
      await logActivity(item.lead_id, `GMap outreach: skipped — no contact form found on ${item.website_url}`);
      console.log(`[gmaps-runner] No contact form found for ${item.lead_id}`);
    } else {
      await markFailed(item.id, result.error);
      await logActivity(item.lead_id, `GMap outreach: contact form failed — ${result.error}`);
      console.log(`[gmaps-runner] Contact form FAILED for ${item.lead_id}: ${result.error}`);
    }

  } else if (item.action_type === "sms_follow_up") {
    if (!item.phone) {
      await markSkipped(item.id, "no_phone_number");
      return;
    }

    const result = await sendSms(item.phone, item.message);

    if (result.success) {
      await markDone(item.id, `Twilio SID: ${result.sid}`);
      await logActivity(item.lead_id, `GMap outreach: SMS follow-up sent to ${item.phone}`);
      await sendTelegramAlert(`SMS follow-up sent to lead ${item.lead_id}`);
      console.log(`[gmaps-runner] SMS sent to ${item.phone}, SID: ${result.sid}`);
    } else {
      await markFailed(item.id, result.error);
      console.log(`[gmaps-runner] SMS FAILED for ${item.lead_id}: ${result.error}`);
    }
  }

  await randomDelay(2000, 5000);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

console.log(`[gmaps-runner] Starting. Poll interval: ${POLL_INTERVAL / 1000}s. Active hours: ${ACTIVE_START}:00–${ACTIVE_END}:00 weekdays.`);
runOnce().catch(console.error);
setInterval(() => runOnce().catch(console.error), POLL_INTERVAL);
