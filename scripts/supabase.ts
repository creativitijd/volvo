/* eslint-disable @typescript-eslint/no-explicit-any -- ruwe JSON van externe bronnen */
// Optionele opslag in Supabase. Doet niets zolang de env-variabelen ontbreken.
// Schema: zie supabase/schema.sql

import type { Listing, Source } from "../src/lib/types.ts";

/** Legacy keys (eyJ…) zijn een JWT en horen ook in Authorization. sb_secret_ is dat niet. */
export function supabaseHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  const value = key.trim();
  const headers: Record<string, string> = { apikey: value, ...extra };
  if (value.startsWith("eyJ")) headers.authorization = `Bearer ${value}`;
  return headers;
}

export async function saveToSupabase(source: Source, listings: Listing[], now: number) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.log("(Supabase niet geconfigureerd — enkel het lokale JSON-bestand bijgewerkt)");
    return;
  }

  const headers = supabaseHeaders(key, { "content-type": "application/json" });
  const rest = `${url}/rest/v1`;

  // 1. Bestaande prijzen ophalen om prijswijzigingen te detecteren
  // (de lokale JSON bestaat niet in CI, dus Supabase is hier de bron van waarheid)
  const existing = new Map<
    string,
    { price: number; first_seen: string; previous_price: number | null; price_history: [number, number][] | null }
  >();
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${rest}/listings?select=id,price,first_seen,previous_price:data->previousPrice,price_history:data->priceHistory&source=eq.${source}&order=id`,
      { headers: { ...headers, range: `${from}-${from + 999}` } },
    );
    if (!res.ok) throw new Error(`Supabase select: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    for (const r of rows) existing.set(r.id, r);
    if (rows.length < 1000) break;
  }

  const iso = new Date(now).toISOString();
  const rows = listings.map((l) => {
    const prev = existing.get(l.id);
    const data: Listing = prev
      ? {
          ...l,
          firstSeen: Date.parse(prev.first_seen),
          previousPrice: prev.price !== l.price ? prev.price : prev.previous_price,
          priceHistory: mergeHistory(prev.price_history ?? [[Date.parse(prev.first_seen), prev.price]], l.price, now),
        }
      : l;
    return {
      id: l.id,
      source: l.source,
      data,
      price: l.price,
      model: l.model,
      active: true,
      first_seen: prev?.first_seen ?? iso,
      last_seen: iso,
    };
  });

  // 2. Upsert in blokken
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${rest}/listings?on_conflict=id`, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`Supabase upsert: ${res.status} ${await res.text()}`);
  }

  // 3. Prijshistoriek: enkel nieuwe wagens en prijswijzigingen
  const history = listings
    .filter((l) => !existing.has(l.id) || existing.get(l.id)!.price !== l.price)
    .map((l) => ({ listing_id: l.id, price: l.price, seen_at: iso }));
  if (history.length) {
    const res = await fetch(`${rest}/price_history`, {
      method: "POST",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify(history),
    });
    if (!res.ok) throw new Error(`Supabase history: ${res.status} ${await res.text()}`);
  }

  // 4. Verdwenen wagens op inactief zetten — maar nooit een groot deel van een bron in één keer
  const present = new Set(listings.map((l) => l.id));
  const gone = [...existing.keys()].filter((id) => !present.has(id)).length;
  if (existing.size > 100 && gone > existing.size * 0.3) {
    throw new Error(
      `${gone} van ${existing.size} wagens (${Math.round((gone / existing.size) * 100)}%) zouden verdwijnen bij ${source} — ` +
        `afgebroken. Draai opnieuw of verhoog de drempel als dit klopt.`,
    );
  }

  const res = await fetch(`${rest}/listings?source=eq.${source}&last_seen=lt.${encodeURIComponent(iso)}&active=eq.true`, {
    method: "PATCH",
    headers: { ...headers, prefer: "return=minimal" },
    body: JSON.stringify({ active: false }),
  });
  if (!res.ok) throw new Error(`Supabase deactivate: ${res.status} ${await res.text()}`);

  console.log(`✓ Supabase: ${rows.length} upserts, ${history.length} prijsregels`);
}

function mergeHistory(history: [number, number][], price: number, now: number): [number, number][] {
  return (history.at(-1)?.[1] === price ? history : [...history, [now, price] as [number, number]]).slice(-60);
}
