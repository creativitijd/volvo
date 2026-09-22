/* eslint-disable @typescript-eslint/no-explicit-any -- ruwe JSON van externe bronnen */
// Scraper voor de Belgische Volvo-stock (volvostock.be).
// Gebruik: node scripts/scrape-be.ts
// Schrijft data/listings.json en — als SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gezet zijn — ook naar Supabase.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { Listing, Snapshot } from "../src/lib/types.ts";
import { saveToSupabase } from "./supabase.ts";
import { withHistory } from "./history.ts";

const BASE = "https://www.volvostock.be";
const LIST_URL = `${BASE}/nl/vehicles/new`;
const OUT = new URL("../data/volvo_be.json", import.meta.url);
const USER_AGENT = "VindEenVolvoBot/0.1 (+https://vindeenvolvo.be)";
const DELAY_MS = 1200;
const MAX_PAGES = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ total: number; results: any[] }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${LIST_URL}?page=${page}`, {
      headers: { "user-agent": USER_AGENT, "accept-language": "nl-BE,nl;q=0.9" },
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) throw new Error(`Geen __NEXT_DATA__ op pagina ${page}`);
      const v = JSON.parse(m[1]).props.pageProps.vehicles;
      return { total: v.totalCount, results: v.results ?? [] };
    }
    console.warn(`Pagina ${page}: HTTP ${res.status} (poging ${attempt})`);
    await sleep(DELAY_MS * attempt * 2);
  }
  throw new Error(`Pagina ${page} faalde na 3 pogingen`);
}

export function imageUrl(pictureId: string, width = 900): string {
  const spec = {
    key: `volvo-stock-be/${pictureId}`,
    edits: { resize: { width, fit: "inside", withoutEnlargement: true }, webp: { quality: 75 } },
    outputFormat: "webp",
  };
  return `https://images.hyperportal.org/${Buffer.from(JSON.stringify(spec)).toString("base64")}`;
}

const num = (x: unknown): number | null => {
  const n = typeof x === "string" ? parseFloat(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : null;
};

const round = (n: number | null) => (n == null ? null : Math.round(n));

const FUEL: Record<string, string> = {
  ELECTRIC: "Elektrisch",
  PETROL: "Benzine",
  PHEV: "Plug-in hybride",
};

function normalize(r: any, now: number): Listing {
  const d = r.dealer;
  const hp = num(r.spec?.maxPower?.replace(/[^\d.]/g, "")) ?? (r.maxPowerKw ? Math.round(r.maxPowerKw * 1.35962) : null);
  const fuelTitle: string = r.fuel?.titleNl ?? r.fuel?.title ?? "Onbekend";
  const fuel = FUEL[r.fuel?.code] ?? (/plug-in/i.test(fuelTitle) ? "Plug-in hybride" : fuelTitle);
  return {
    id: `volvo_be:${r.entityId}`,
    source: "volvo_be",
    sourceId: r.entityId,
    country: "BE",
    url: `${BASE}/nl/vehicle/${r.vehicleUrlSlug}`,
    condition: r.condition?.code === "new" ? "new" : "used",
    vin: r.vin ?? null,
    model: r.productLine?.code ?? r.productLine?.title ?? "Volvo",
    title: r.customTitleNl ?? r.title,
    modelYear: num(r.dateModelYear),
    fuel,
    powertrain: r.engine?.descriptionNl ?? r.engine?.description ?? null,
    drive: r.driveType?.code ? r.driveType.code.replace(/^E_/, "") : null,
    powerHp: hp,
    trim: r.finish?.titleNl ?? r.finish?.title ?? null,
    body: r.silhouette?.titleNl ?? r.silhouette?.title ?? null,
    color: r.color?.titleNl ?? r.color?.title ?? null,
    interior: r.trim?.name?.trim() ?? null,
    transmission: r.transmission?.title ?? null,
    mileageKm: null,
    listPrice: round(num(r.priceVat)),
    price: round(num(r.computedPrice) ?? num(r.priceVat)) ?? 0,
    options: (r.optionsE ?? []).map((o: any) => o.computedNlTitle ?? o.titleNl ?? o.title).filter(Boolean),
    packs: (r.optionPacks ?? [])
      .map((p: any) => p.titleNl ?? p.title)
      .filter((t: string) => t && !/^Gebruikstaal/i.test(t)),
    images: (r.pictures ?? []).slice(0, 6).map((id: string) => imageUrl(id)),
    dealer: d
      ? {
          name: d.websiteTitle ?? d.title ?? d.name,
          group: d.dealerGroup ?? null,
          street: d.dealerAddress ?? d.address ?? null,
          zip: d.dealerZip ?? d.zip ?? null,
          city: d.dealerCity ? titleCase(d.dealerCity) : null,
          phone: d.dealerPhone ?? d.phone ?? null,
          lat: num(d.geolocation?.lat),
          lon: num(d.geolocation?.lon),
        }
      : null,
    listedAt: num(r.createdAt),
    firstSeen: now,
    lastSeen: now,
    previousPrice: null,
  };
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
}

async function loadPrevious(): Promise<Map<string, Listing>> {
  try {
    const snap: Snapshot = JSON.parse(await readFile(OUT, "utf8"));
    return new Map(snap.listings.map((l) => [l.id, l]));
  } catch {
    return new Map();
  }
}

async function main() {
  const now = Date.now();
  const previous = await loadPrevious();
  const raw: any[] = [];

  const first = await fetchPage(1);
  raw.push(...first.results);
  const perPage = first.results.length || 21;
  const pages = Math.min(Math.ceil(first.total / perPage), MAX_PAGES);
  console.log(`${first.total} wagens, ${pages} pagina's`);

  for (let p = 2; p <= pages; p++) {
    await sleep(DELAY_MS);
    const { results } = await fetchPage(p);
    raw.push(...results);
    process.stdout.write(`\rPagina ${p}/${pages}`);
  }
  console.log();

  const byId = new Map<string, Listing>();
  for (const r of raw) {
    const l = normalize(r, now);
    byId.set(l.id, withHistory(l, previous.get(l.id), now));
  }
  const listings = [...byId.values()];

  // Sanity check: niet een halve/lege scrape wegschrijven
  if (listings.length < first.total * 0.9) {
    throw new Error(`Slechts ${listings.length}/${first.total} wagens opgehaald — afgebroken`);
  }

  const snapshot: Snapshot = { updatedAt: now, listings };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot));

  const added = listings.filter((l) => !previous.has(l.id)).length;
  const removed = [...previous.keys()].filter((id) => !byId.has(id)).length;
  console.log(`✓ ${listings.length} wagens opgeslagen (${added} nieuw, ${removed} verdwenen)`);

  await saveToSupabase("volvo_be", listings, now);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
