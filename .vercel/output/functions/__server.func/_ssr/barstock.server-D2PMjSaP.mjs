import { c as createClient } from "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "tslib";
import "../_libs/supabase__functions-js.mjs";
let cached = null;
function getBarstock() {
  if (cached) return cached;
  const rawUrl = process.env.BARSTOCK_SUPABASE_URL;
  const key = process.env.BARSTOCK_SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) {
    throw new Error("BarStock Supabase credentials are not configured");
  }
  const url = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}
export {
  getBarstock
};
