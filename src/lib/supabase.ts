import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Browserclient voor login, favorieten en meldingen. `null` zolang Supabase niet geconfigureerd is. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key || typeof window === "undefined") return null;
  return createBrowserClient(url, key); // singleton in de browser
}

export const accountsEnabled = Boolean(url && key);
