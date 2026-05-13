import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
      console.error("[appointments] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[appointments] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
