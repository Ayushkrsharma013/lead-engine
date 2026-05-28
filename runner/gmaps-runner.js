// runner/gmaps-runner.js
// Local GMap outreach runner — runs on your home machine (residential IP).
// Polls gmaps_outreach_queue every 5 min.
// contact_form_fill → Playwright navigates website, fills contact form.
// sms_follow_up    → inserts into Supabase gmaps_outreach_queue; n8n picks up on schedule.
// Never run this on a server.

require("dotenv").config();
const path = require("path");
const os = require("os");

const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || "ayush@flow-forges.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

if (!CRON_SECRET) {
  console.error("[gmaps-runner] Missing CRON_SECRET — needed for API auth");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[gmaps-runner] Missing SUPABASE_URL / SUPABASE_KEY — needed for SMS queue");
  process.exit(1);
}

const MAX_FORM_FILLS = parseInt(process.env.MAX_FORM_FILLS_PER_DAY ?? "30", 10);
const MAX_SMS = parseInt(process.env.MAX_SMS_PER_DAY ?? "20", 10);
const ACTIVE_START = parseInt(process.env.ACTIVE_HOURS_START ?? "9", 10);
const ACTIVE_END = parseInt(process.env.ACTIVE_HOURS_END ?? "18", 10);

const POLL_INTERVAL = 5 * 60 * 1000;
const PROFILE_DIR = path.join(os.homedir(), ".gmaps-runner", "profile");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBusinessName(message) {
  const m = message && message.match(/^Hi, I emailed (.+?) about recovering/);
  return m ? m[1] : '';
}

function isActiveHour() {
  const h = new Date().getHours();
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  return h >= ACTIVE_START && h < ACTIVE_END;
}

function randomDelay(minMs, maxMs) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
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

// ─── Main poll cycle ──────────────────────────────────────────────────────────

async function writeHeartbeat() {
  try {
    const secret = process.env.CRON_SECRET || "gmaps-runner-heartbeat";
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://app.flow-forges.com"}/prospecting-os/api/gmaps-outreach/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ activeHours: isActiveHour() }),
    });
  } catch (e) {
    // silent — heartbeat is non-critical
  }
}

async function callApi(method, path, body) {
  const secret = process.env.CRON_SECRET || "gmaps-runner-heartbeat";
  const base = process.env.API_BASE || (process.env.NEXT_PUBLIC_SITE_URL || "https://app.flow-forges.com") + "/prospecting-os";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

async function runOnce() {
  await writeHeartbeat();

  if (!isActiveHour()) {
    console.log(`[gmaps-runner] Outside active hours (${ACTIVE_START}:00–${ACTIVE_END}:00, weekdays only) — skipping`);
    return;
  }

  // Fetch pending items + daily counts via API
  let queueData;
  try {
    queueData = await callApi("GET", "/api/gmaps-outreach/queue");
  } catch (e) {
    console.log(`[gmaps-runner] API error: ${e.message}`);
    return;
  }

  const items = queueData.items || [];
  const counts = queueData.dailyCounts || { formsFilled: 0, smsSent: 0 };

  if (items.length === 0) {
    console.log(`[gmaps-runner] No pending items — forms: ${counts.formsFilled}/${MAX_FORM_FILLS}, SMS: ${counts.smsSent}/${MAX_SMS}`);
    return;
  }

  const item = items[0];

  if (item.action_type === "contact_form_fill" && counts.formsFilled >= MAX_FORM_FILLS) {
    console.log(`[gmaps-runner] Daily form fill cap reached (${MAX_FORM_FILLS}) — skipping`);
    return;
  }
  if (item.action_type === "sms_follow_up" && counts.smsSent >= MAX_SMS) {
    console.log(`[gmaps-runner] Daily SMS cap reached (${MAX_SMS}) — skipping`);
    return;
  }

  // Mark executing via API
  try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "executing" }); } catch {}
  console.log(`[gmaps-runner] Processing ${item.action_type} for lead ${item.lead_id}`);

  if (item.action_type === "contact_form_fill") {
    if (!item.website_url) {
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "skipped", error: "no_website_url" }); } catch {}
      console.log(`[gmaps-runner] Skipped — no website URL`);
      return;
    }

    const result = await fillContactForm(item.website_url, item.message);

    if (result.success) {
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "done" }); } catch {}
      await sendTelegramAlert(`Contact form sent to lead ${item.lead_id}`);
      console.log(`[gmaps-runner] Contact form filled for ${item.lead_id}`);
    } else if (result.error === "no_contact_form") {
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "skipped", error: "no_contact_form" }); } catch {}
      console.log(`[gmaps-runner] No contact form found for ${item.lead_id}`);
    } else {
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "failed", error: result.error }); } catch {}
      console.log(`[gmaps-runner] Contact form FAILED for ${item.lead_id}: ${result.error}`);
    }

  } else if (item.action_type === "sms_follow_up") {
    if (!item.phone) {
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "skipped", error: "no_phone_number" }); } catch {}
      return;
    }

    const businessName = extractBusinessName(item.message);
    const industry = item.industry || 'dental';

    // Insert into Supabase gmaps_outreach_queue — n8n picks it up on schedule
    let insertRes;
    try {
      insertRes = await fetch(`${SUPABASE_URL}/rest/v1/gmaps_outreach_queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          phone_number: item.phone,
          business_name: businessName,
          industry,
          action: 'sms_follow_up',
          status: 'pending',
          source: String(item.lead_id || ''),
        }),
      });
    } catch (fetchErr) {
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "failed", error: `supabase_fetch_error: ${fetchErr.message}` }); } catch {}
      console.error(`[gmaps-runner] Supabase queue insert failed for ${item.phone}: ${fetchErr.message}`);
      return;
    }

    if (!insertRes.ok) {
      const body = await insertRes.text();
      console.error(`[gmaps-runner] Supabase queue insert error for ${item.phone}: ${insertRes.status} ${body}`);
      try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "failed", error: `supabase_error_${insertRes.status}` }); } catch {}
      return;
    }

    try { await callApi("PATCH", "/api/gmaps-outreach/queue", { id: item.id, status: "done", error: "queued_for_sms" }); } catch {}
    await sendTelegramAlert(`SMS queued for lead ${item.lead_id} (${item.phone}) — n8n will send shortly`);
    console.log(`[gmaps-runner] SMS queued in Supabase for ${item.phone} (lead ${item.lead_id})`);
  }

  await randomDelay(2000, 5000);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

console.log(`[gmaps-runner] Starting. Poll interval: ${POLL_INTERVAL / 1000}s. Active hours: ${ACTIVE_START}:00–${ACTIVE_END}:00 weekdays.`);
runOnce().catch(console.error);
setInterval(() => runOnce().catch(console.error), POLL_INTERVAL);
