/**
 * Supabase Client Utilities for Testing
 *
 * Provides three client types for comprehensive testing:
 * - supabaseAnon: public anon key client (simulates unauthenticated browser)
 * - supabaseAdmin: service role key client (bypasses RLS, for setup/cleanup)
 * - supabaseAuth: helper to sign in as a specific user and get an authenticated client
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

// Load .env from tests/ directory
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.SUPABASE_URL
  || "https://otxifqcvgmxoxemmgbjd.supabase.co";

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ADMIN_KEY
  || "";

// Clean URL — strip /rest/v1 suffix if present
const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");

/**
 * Anonymous client (simulates unauthenticated browser user).
 * Uses the public anon key — subject to RLS policies.
 */
export const supabaseAnon: SupabaseClient = createClient(cleanUrl, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Admin client with service role key — bypasses all RLS policies.
 * USE ONLY for test setup/teardown. Never use for assertions about
 * what a normal user can do.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  cleanUrl,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Create an authenticated Supabase client for a specific user.
 * Signs in with email/password and returns a client with the user's session.
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns SupabaseClient with authenticated session, or null if login fails
 */
export async function createAuthClient(
  email: string,
  password: string
): Promise<SupabaseClient | null> {
  const client = createClient(cleanUrl, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    console.error(`[supabase_client] Login failed for ${email}:`, error?.message);
    return null;
  }

  // Re-create client with the session token so all requests are authenticated
  return createClient(cleanUrl, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
}

/**
 * Verify the admin client is working by checking server time.
 * Returns true if connection is healthy.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}
