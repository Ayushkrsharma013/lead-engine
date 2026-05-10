import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
if (!supabaseAnonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");

const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
