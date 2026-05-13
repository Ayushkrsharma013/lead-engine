import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const { error } = await supabase.from("email_captures").insert({
      email: email.trim().toLowerCase(),
      source: "landing_page",
    });

    if (error) {
      // Duplicate email is fine — don't fail
      if (error.code === "23505") {
        return NextResponse.json({ ok: true });
      }
      console.error("[capture] supabase insert failed:", error.message);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[capture] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
