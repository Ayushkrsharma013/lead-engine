import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { createCalendarEvent, isCalendarConnected } from "@/lib/google-calendar";
import { sendTelegramNotification, sendEmailNotification, sendAttendeeConfirmation, sendCancellationEmail, notifyTelegram } from "@/lib/notify";
import { sendEmail } from "@/lib/resend";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/types";
import type { MeetingType, AppointmentInput, Appointment } from "@/lib/types";
import { MEETING_TYPES, APPOINTMENT_BUFFER_MINUTES, MAX_BOOKINGS_PER_DAY, BUSINESS_HOURS_START, BUSINESS_HOURS_END, WEEKEND_DAYS } from "@/lib/types";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isValidMeetingType(t: string): t is MeetingType {
  return t in MEETING_TYPES;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatEndTime(startTime: string, durationMinutes: number): string {
  const totalMinutes = timeToMinutes(startTime) + durationMinutes;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const token = searchParams.get("token");

    // Token-based lookup — used by onboarding page (no auth required)
    if (token) {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("onboarding_token", token)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Invalid or expired onboarding token" }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    if (id) {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.message.includes("Could not find") || error.code === "42P01") {
          return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
        }
        console.error("[appointments] fetch by id failed:", error.message);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    let query = supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message.includes("Could not find") || error.code === "42P01") {
        return NextResponse.json({ error: "Table not found" }, { status: 500 });
      }
      console.error("[appointments] fetch failed:", error.message);
      return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("[appointments] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: AppointmentInput = await req.json();
    const { date, time, name, email, phone, company, notes, type, timezone, plan } = body;

    if (!date || !time || !name || !email || !type || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields (date, time, name, email, type, timezone)" },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (!isValidMeetingType(type)) {
      return NextResponse.json(
        { error: "Invalid meeting type. Must be one of: discovery, demo, technical, strategy" },
        { status: 400 }
      );
    }

    const duration = MEETING_TYPES[type].duration;

    // Weekend validation
    const dayOfWeek = new Date(date).getDay();
    if (WEEKEND_DAYS.includes(dayOfWeek)) {
      return NextResponse.json(
        { error: "Weekend bookings are not accepted. Please select a weekday." },
        { status: 400 }
      );
    }

    // Business hours validation
    const startMinutes = timeToMinutes(time);
    const endMinutes = startMinutes + duration;
    const businessStart = BUSINESS_HOURS_START * 60;
    const businessEnd = BUSINESS_HOURS_END * 60;

    if (startMinutes < businessStart || endMinutes > businessEnd) {
      return NextResponse.json(
        { error: `Booking must be within business hours (${BUSINESS_HOURS_START}:00 - ${BUSINESS_HOURS_END}:00)` },
        { status: 400 }
      );
    }

    // Fetch existing bookings for this date (for daily max + buffer + double-booking)
    const { data: existingToday } = await supabase
      .from("appointments")
      .select("time, notes")
      .eq("date", date);

    // Daily max check (skip cancelled bookings via notes fallback marker)
    const activeBookings = (existingToday || []).filter((ex: any) => {
      if (ex.notes && String(ex.notes).startsWith("[CANCELLED]")) return false;
      return true;
    });

    if (activeBookings.length >= MAX_BOOKINGS_PER_DAY) {
      return NextResponse.json(
        { error: "This date is fully booked. Please choose another day." },
        { status: 400 }
      );
    }

    if (activeBookings.length > 0) {
      const newStart = startMinutes;
      const newEnd = startMinutes + duration;
      const bufferStart = newStart - APPOINTMENT_BUFFER_MINUTES;
      const bufferEnd = newEnd + APPOINTMENT_BUFFER_MINUTES;

      for (const existing of activeBookings) {
        const existingStart = timeToMinutes(existing.time);
        const ex = existing as any;
        const existingDuration = ex.duration || 30;
        const existingEnd = existingStart + existingDuration;

        // Exact double-booking
        if (existingStart === newStart) {
          return NextResponse.json(
            { error: "This time slot is already booked. Please choose another time." },
            { status: 409 }
          );
        }

        // Buffer overlap
        if (existingStart < bufferEnd && existingEnd > bufferStart) {
          return NextResponse.json(
            { error: "This time slot conflicts with an existing booking. Please choose another time." },
            { status: 409 }
          );
        }
      }
    }

    const endTime = formatEndTime(time, duration);

    // Try insert with all columns first; fall back to base columns if schema is old
    const fullInsert = {
      date,
      time,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      company: (company || "").trim(),
      notes: (notes || "").trim(),
      type,
      duration,
      status: "confirmed",
      timezone,
      plan: plan || null,
    };

    const baseInsert = {
      date,
      time,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: (company || "").trim(),
      notes: (notes || "").trim(),
      plan: plan || null,
    };

    let { data, error } = await supabase
      .from("appointments")
      .insert(fullInsert)
      .select("id")
      .single();

    // If new columns don't exist yet, fall back to base columns
    if (error && (error.message.includes("Could not find") || error.code === "42P01")) {
      ({ data, error } = await supabase
        .from("appointments")
        .insert(baseInsert)
        .select("id")
        .single());
    }

    if (error) {
      console.error("[appointments] insert failed:", error.message);
      return NextResponse.json(
        {
          error: "Could not save your booking. Please try again or email support@flow-forges.com.",
          code: "BOOKING_FAILED",
        },
        { status: 500 }
      );
    }

    // Create Google Calendar event (non-blocking)
    let calendarLink: string | undefined;
    if (isCalendarConnected()) {
      try {
        const calResult = await createCalendarEvent({
          summary: `${MEETING_TYPES[type].label}: ${name.trim()}${company ? ` — ${company.trim()}` : ""}`,
          description: [
            `New booking from Prospecting OS.`,
            `Name: ${name.trim()}`,
            `Email: ${email.trim().toLowerCase()}`,
            company ? `Company: ${company.trim()}` : "",
            phone ? `Phone: ${phone.trim()}` : "",
            `Type: ${MEETING_TYPES[type].label}`,
            `Duration: ${duration} min`,
          ].filter(Boolean).join("\n"),
          startDate: date,
          startTime: time,
          endTime,
          timezone: timezone || "Asia/Kolkata",
          attendees: [{ email: email.trim().toLowerCase(), displayName: name.trim() }],
        });
        if (calResult.htmlLink) {
          calendarLink = calResult.htmlLink;
        } else if (calResult.error) {
          console.warn("[appointments] calendar event skipped:", calResult.error);
        }
      } catch (err) {
        console.warn("[appointments] calendar event creation failed:", err);
      }
    }

    // Fire admin notifications + attendee confirmation in parallel (non-blocking)
    const bookingDetails = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company ? company.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      phone: phone?.trim() || undefined,
      type,
      duration,
      date,
      time,
      timezone: timezone || "Asia/Kolkata",
      calendarLink,
      plan: plan || undefined,
    };

    void Promise.all([
      sendTelegramNotification(bookingDetails),
      sendEmailNotification(bookingDetails),
      sendAttendeeConfirmation(bookingDetails),
    ]);

    return NextResponse.json({ ok: true, id: data?.id, calendarLink });
  } catch (err) {
    console.error("[appointments] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, date, time, type, timezone, token } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing required fields (id, status)" }, { status: 400 });
    }

    if (status !== "cancelled" && status !== "rescheduled" && status !== "won" && status !== "completed") {
      return NextResponse.json({ error: "Status must be 'cancelled', 'rescheduled', 'won', or 'completed'" }, { status: 400 });
    }

    // ── Auth: require valid session or matching onboarding_token ──────────
    let isAuthenticated = false;
    let isAdmin = false;

    // Session-based auth via Supabase SSR cookie
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
    try {
      // Read cookies manually for SSR auth check
      const cookieHeader = req.headers.get("cookie") || "";
      // Attempt token-based lookup first (for onboarding flow)
      if (token) {
        const { data: tokenAppt } = await supabase
          .from("appointments")
          .select("id, onboarding_token")
          .eq("id", id)
          .eq("onboarding_token", token)
          .maybeSingle();
        if (tokenAppt) isAuthenticated = true;
      }

      // Session-based auth — parse cookies and verify with Supabase
      if (!isAuthenticated && cookieHeader) {
        // Parse supabase auth token from cookies
        const cookies = cookieHeader.split(";").reduce((acc, c) => {
          const [k, v] = c.trim().split("=");
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {} as Record<string, string>);

        // Look for Supabase auth cookie (sb-*-auth-token pattern)
        const authCookieKey = Object.keys(cookies).find(k =>
          k.includes("-auth-token") && k.startsWith("sb-")
        );
        if (authCookieKey) {
          const tokenParts = cookies[authCookieKey];
          if (tokenParts) {
            try {
              const parsed = JSON.parse(decodeURIComponent(tokenParts));
              const accessToken = parsed?.access_token;
              if (accessToken) {
                const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
                if (user && !authErr) {
                  isAuthenticated = true;
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();
                  if (profile?.role === "super_admin" || profile?.role === "qa_agent") {
                    isAdmin = true;
                  }
                }
              }
            } catch { /* cookie parse failed, fall through */ }
          }
        }
      }
    } catch { /* auth check failed, fall through */ }

    // "won" and "completed" require admin authentication
    if ((status === "won" || status === "completed") && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized — admin access required for this action" }, { status: 401 });
    }

    // All other status changes require at least token or session auth
    if (!isAuthenticated && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized — valid session or token required" }, { status: 401 });
    }

    // Fetch existing appointment
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (status === "cancelled") {
      // Try with status column first; fall back to notes-only if schema is old
      let { error: updateError } = await supabase
        .from("appointments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) {
        // Fallback: mark cancelled in notes if status column doesn't exist
        ({ error: updateError } = await supabase
          .from("appointments")
          .update({ notes: "[CANCELLED] " + (appointment.notes || "") })
          .eq("id", id));
      }

      if (updateError) {
        console.error("[appointments] cancel failed:", updateError.message);
        return NextResponse.json({ error: "Failed to cancel appointment" }, { status: 500 });
      }

      void sendCancellationEmail({
        name: appointment.name,
        email: appointment.email,
        date: appointment.date,
        time: appointment.time,
        type: appointment.type,
      });

      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    // ── Mark as Won — generate onboarding token and send email ─────────
    if (status === "won") {
      const onboardingToken = crypto.randomUUID();
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "won",
          onboarding_token: onboardingToken,
          onboarding_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.error("[appointments] won update failed:", updateError.message);
        return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
      }

      const planKey = (appointment.plan || "pilot") as PlanKey;
      const planName = PLANS[planKey]?.name || "Prospecting OS";
      const planPrice = PLANS[planKey]?.displaySetup || "";
      const onboardingUrl = `https://app.flow-forges.com/prospecting-os/onboarding?token=${onboardingToken}`;

      // Send onboarding email to client
      void sendEmail({
        to: appointment.email,
        subject: `Your ${planName} Setup is Ready — Start Onboarding`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <td style="background:#e8420a;padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">Your Setup is Ready</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;color:#f5f4f1;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Hi ${appointment.name},</p>
            <p style="margin:0 0 16px;">Great news — your <strong>${planName}</strong> (${planPrice}) setup is ready to begin. Complete your onboarding in just a few minutes to configure your ICP and activate your lead pipeline.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${onboardingUrl}" style="display:inline-block;background:#e8420a;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:999px;">
                Start Setup &rarr;
              </a>
            </div>
            <p style="margin:24px 0 0;font-size:13px;color:#7a7875;">
              This link is unique to you. If you have any questions, reply to this email or book a call at <a href="https://app.flow-forges.com/prospecting-os/book" style="color:#e8420a;text-decoration:none;">app.flow-forges.com/book</a>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#7a7875;font-size:12px;text-align:center;">
              Prospecting OS &middot; <a href="https://app.flow-forges.com/prospecting-os" style="color:#e8420a;text-decoration:none;">app.flow-forges.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      }).catch(err => console.warn("[appointments] onboarding email failed:", err));

      // Telegram alert to founder
      void notifyTelegram(
        `MEETING WON — ${appointment.name} (${appointment.email}) for ${planName}\nOnboarding link sent. Token: ${onboardingToken.slice(0, 8)}...`
      ).catch(err => console.error("[appointments] Telegram notify failed:", err));

      return NextResponse.json({ ok: true, status: "won", onboardingToken });
    }

    // ── Mark as Completed ─────────────────────────────────────────────
    if (status === "completed") {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.error("[appointments] completed update failed:", updateError.message);
        return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "completed" });
    }

    if (status === "rescheduled") {
      if (!date || !time) {
        return NextResponse.json({ error: "New date and time required for rescheduling" }, { status: 400 });
      }

      const newType = type || appointment.type;
      const newTimezone = timezone || appointment.timezone || "Asia/Kolkata";
      const effectiveType = isValidMeetingType(newType) ? newType : "demo";
      const duration = MEETING_TYPES[effectiveType].duration;

      // Weekend validation
      const dayOfWeek = new Date(date).getDay();
      if (WEEKEND_DAYS.includes(dayOfWeek)) {
        return NextResponse.json({ error: "Weekend bookings are not accepted" }, { status: 400 });
      }

      // Business hours validation
      const startMinutes = timeToMinutes(time);
      const endMinutes = startMinutes + duration;
      const businessStart = BUSINESS_HOURS_START * 60;
      const businessEnd = BUSINESS_HOURS_END * 60;

      if (startMinutes < businessStart || endMinutes > businessEnd) {
        return NextResponse.json(
          { error: `Booking must be within business hours (${BUSINESS_HOURS_START}:00 - ${BUSINESS_HOURS_END}:00)` },
          { status: 400 }
        );
      }

      // Daily max check
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("date", date);

      if (count !== null && count >= MAX_BOOKINGS_PER_DAY) {
        return NextResponse.json({ error: "This date is fully booked. Please choose another day." }, { status: 400 });
      }

      // Buffer and double-booking check (exclude current appointment)
      const { data: existingToday } = await supabase
        .from("appointments")
        .select("id, time, type, duration, status")
        .eq("date", date);

      if (existingToday) {
        const newStart = startMinutes;
        const newEnd = startMinutes + duration;
        const bufferStart = newStart - APPOINTMENT_BUFFER_MINUTES;
        const bufferEnd = newEnd + APPOINTMENT_BUFFER_MINUTES;

        for (const existing of existingToday) {
          if (existing.id === id) continue;

          const existingStart = timeToMinutes(existing.time);
          const existingDuration = (existing as any).duration || 30;
          const existingEnd = existingStart + existingDuration;

          if (existingStart === newStart) {
            return NextResponse.json({ error: "This time slot is already booked" }, { status: 409 });
          }

          if (existingStart < bufferEnd && existingEnd > bufferStart) {
            return NextResponse.json({ error: "This time slot conflicts with an existing booking" }, { status: 409 });
          }
        }
      }

      const endTime = formatEndTime(time, duration);

      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          date,
          time,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.error("[appointments] reschedule failed:", updateError.message);
        return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "rescheduled" });
    }

    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  } catch (err) {
    console.error("[appointments] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
