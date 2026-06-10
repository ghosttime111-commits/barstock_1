import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getBarstock(): SupabaseClient {
  if (cached) return cached;
  const rawUrl = process.env.BARSTOCK_SUPABASE_URL;
  const key = process.env.BARSTOCK_SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) {
    throw new Error("BarStock Supabase credentials are not configured");
  }
  const url = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type SessionUser = {
  id: string;
  name: string;
  login: string;
  role: string;
  restaurant_id: string | null;
};
