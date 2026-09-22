import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Listing, Snapshot } from "./types";
import { privateToListing, type PrivateListingRow } from "./private";

/**
 * Haalt de actuele stock op: uit Supabase als die geconfigureerd is,
 * anders uit de lokale snapshotbestanden in data/.
 */
export async function getSnapshot(): Promise<Snapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const [snap, ads] = await Promise.all([fromSupabase(url, key), privateAds(url, key)]);
    return { ...snap, listings: [...snap.listings, ...ads] };
  }

  // Lokaal: één bestand per bron (data/volvo_be.json, data/volvo_selekt.json, ...)
  const dir = path.join(process.cwd(), "data");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return { updatedAt: 0, listings: [] };
  }
  const files = names.filter((f) => /^[a-z0-9_]+\.json$/.test(f));
  const snaps: Snapshot[] = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8"))));
  return {
    updatedAt: Math.max(0, ...snaps.map((s) => s.updatedAt)),
    listings: snaps.flatMap((s) => s.listings),
  };
}

async function fromSupabase(url: string, key: string): Promise<Snapshot> {
  const headers = { apikey: key, authorization: `Bearer ${key}` };
  const listings: Listing[] = [];
  let updatedAt = 0;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${url}/rest/v1/listings?select=data,last_seen&active=eq.true&order=id`, {
      headers: { ...headers, range: `${from}-${from + pageSize - 1}` },
      next: { revalidate: 3600, tags: ["listings"] },
    });
    if (!res.ok) throw new Error(`Supabase: ${res.status}`);
    const rows: { data: Listing; last_seen: string }[] = await res.json();
    for (const r of rows) {
      listings.push(r.data);
      updatedAt = Math.max(updatedAt, Date.parse(r.last_seen));
    }
    if (rows.length < pageSize) break;
  }
  return { updatedAt, listings };
}

/** Goedgekeurde, niet-verlopen particuliere advertenties (RLS laat enkel die door voor de anon key) */
async function privateAds(url: string, key: string): Promise<Listing[]> {
  const res = await fetch(`${url}/rest/v1/private_listings?select=*&order=approved_at.desc`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
    next: { revalidate: 3600, tags: ["listings"] },
  });
  if (!res.ok) return []; // bv. tabel nog niet aangemaakt: de rest van de site blijft werken
  const rows: PrivateListingRow[] = await res.json();
  return rows.map((r) => privateToListing(r));
}

/** Eén particuliere advertentie (voor de detailpagina); `null` als ze niet (meer) publiek is */
export async function getPrivateAd(id: string): Promise<Listing | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const res = await fetch(`${url}/rest/v1/private_listings?select=*&id=eq.${id}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
    next: { revalidate: 300, tags: ["listings"] },
  });
  if (!res.ok) return null;
  const [row]: PrivateListingRow[] = await res.json();
  return row ? privateToListing(row) : null;
}
