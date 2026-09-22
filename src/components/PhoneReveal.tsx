"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Telefoonnummer pas ophalen na een klik. Het nummer staat niet in de publieke advertentiegegevens,
 * dus het is niet in bulk op te vragen; per klik komt er één nummer uit de database.
 */
export function PhoneReveal({ adId }: { adId: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function reveal() {
    const sb = getSupabase();
    if (!sb) return;
    setState("loading");
    const { data, error } = await sb.rpc("ad_phone", { ad: adId });
    if (error || !data) {
      setState("error");
      return;
    }
    setPhone(String(data));
    setState("idle");
  }

  if (phone) {
    return (
      <a
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        className="flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-bg"
      >
        <PhoneIcon /> {phone}
      </a>
    );
  }

  return (
    <div>
      <button
        onClick={reveal}
        disabled={state === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-bg disabled:opacity-60"
      >
        <PhoneIcon /> {state === "loading" ? "Even geduld…" : "Toon telefoonnummer"}
      </button>
      {state === "error" && (
        <p className="mt-2 text-sm text-muted">Het nummer ophalen lukte niet. Herlaad de pagina en probeer opnieuw.</p>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 2.5h2.5l1.2 3-1.5 1a8 8 0 0 0 4.3 4.3l1-1.5 3 1.2V13a1 1 0 0 1-1 1A11.5 11.5 0 0 1 2 3.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}
