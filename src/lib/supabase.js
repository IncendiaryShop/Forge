import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  url && anonKey && !/your-project|your-anon|placeholder/i.test(url + anonKey)
);

if (!isSupabaseConfigured && import.meta.env.DEV) {

  console.warn(
    "[Forge] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set. " +
    "Copy .env.example to .env.local and fill in your Supabase project's " +
    "URL and anon/publishable key."
  );
}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
