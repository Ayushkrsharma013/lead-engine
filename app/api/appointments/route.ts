import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export interface Appointment {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  company: string;
  notes: string;
  created_at: string;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // Table doesn't exist yet — return empty, not an error
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
    const body = await req.json();
    const { date, time, name, email, company, notes } = body;

    if (!date || !time || !name || !email) {
      return NextResponse.json({ error: "Missing required fields (date, time, name, email)" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        date,
        time,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        company: (company || "").trim(),
        notes: (notes || "").trim(),
      })
      .select("id")
      .single();

    if (error) {
      if (error.message.includes("Could not find") || error.code === "42P01") {
        console.warn("[appointments] table not found — run: CREATE TABLE appointments (...);");
        return NextResponse.json({ ok: true, note: "Table not yet created" });
      }
      console.error("[appointments] insert failed:", error.message);
      return NextResponse.json({ ok: true, note: error.message });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[appointments] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
