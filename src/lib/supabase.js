import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Config is considered present only if both values exist and aren't the
// literal placeholder text from .env.example — lets the app detect a
// forgotten/half-filled .env instead of trying to connect with garbage values.
export const isSupabaseConfigured = Boolean(
  url && anonKey && !/your-project|your-anon|placeholder/i.test(url + anonKey)
);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // Dev-only warning — never thrown, never shown to end users. The app
  // renders a dedicated "not configured" screen (see ConfigError.jsx)
  // instead of crashing when these are missing.
  console.warn(
    "[Forge] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set. " +
    "Copy .env.example to .env.local and fill in your Supabase project's " +
    "URL and anon/publishable key."
  );
}

// A single shared client for the whole app. Falls back to obviously-fake
// values when unconfigured so `createClient` itself never throws — the app
// checks `isSupabaseConfigured` up front and never issues real requests
// through this client in that case.
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
