import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createCalendarEvent, isCalendarConnected } from "@/lib/google-calendar";
import { sendTelegramNotification, sendEmailNotification, sendAttendeeConfirmation, sendCancellationEmail } from "@/lib/notify";
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
        return NextResponse.json([]);
      }
      console.error("[appointments] fetch failed:", error.message);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("[appointments] unexpected error:", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body: AppointmentInput = await req.json();
    const { date, time, name, email, phone, company, notes, type, timezone } = body;

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

    // Daily max check
    const { count, error: countError } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("date", date);

    if (countError) {
      if (countError.message.includes("Could not find") || countError.code === "42P01") {
        console.warn("[appointments] table not found — skipping daily max check");
      } else {
        console.error("[appointments] count query failed:", countError.message);
      }
    }

    if (count !== null && count >= MAX_BOOKINGS_PER_DAY) {
      return NextResponse.json(
        { error: "This date is fully booked. Please choose another day." },
        { status: 400 }
      );
    }

    // Buffer time and double-booking check
    const { data: existingToday, error: existingErr } = await supabase
      .from("appointments")
      .select("time")
      .eq("date", date);

    // Try to query with new columns; fall back to base columns if schema is old
    const existingWithMeta = existingErr ? null : existingToday;

    if (existingToday) {
      const newStart = startMinutes;
      const newEnd = startMinutes + duration;
      const bufferStart = newStart - APPOINTMENT_BUFFER_MINUTES;
      const bufferEnd = newEnd + APPOINTMENT_BUFFER_MINUTES;

      for (const existing of existingToday) {
        const existingStart = timeToMinutes(existing.time);
        const existingDuration = (existing as any).duration || 30;
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
    };

    const baseInsert = {
      date,
      time,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: (company || "").trim(),
      notes: (notes || "").trim(),
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
      return NextResponse.json({ ok: true, note: error.message });
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
    const { id, status, date, time, type, timezone } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing required fields (id, status)" }, { status: 400 });
    }

    if (status !== "cancelled" && status !== "rescheduled") {
      return NextResponse.json({ error: "Status must be 'cancelled' or 'rescheduled'" }, { status: 400 });
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
