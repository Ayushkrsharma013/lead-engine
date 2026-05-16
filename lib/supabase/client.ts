import { createBrowserClient } from "@supabase/ssr";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "");

export const createClient = () =>
  createBrowserClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
