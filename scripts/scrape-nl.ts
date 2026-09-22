/* eslint-disable @typescript-eslint/no-explicit-any -- ruwe JSON van externe bronnen */
// Scraper voor de Nederlandse Volvo-stock (volvocars.com/nl/inventory).
//
// ⚠️ NIET IN GEBRUIK: volvocars.com weigert geautomatiseerde browsers (HTTP 403 "Access Denied" voor
// headless Chrome). We omzeilen die blokkering bewust niet. Dit script blijft staan voor als Volvo Car
// Nederland toestemming geeft of een eigen feed aanbiedt; tot dan linkt de site door naar volvocars.com.
//
// Gebruik (enkel met toestemming): node scripts/scrape-nl.ts
//
// - Enkel de lijstpagina's (/nl/inventory/?page=N) worden geladen; de detailpagina's (/nl/shop/details/...)
//   sluit volvocars.com uit in robots.txt, dus daar linken we enkel naar.
// - De site blokkeert gewone HTTP-verzoeken (Akamai), daarom een echte browser (Chrome via Playwright).
// - Per wagen staat een volledig data-object in de React-payload van de pagina ("car":{"vehicle":{...}}).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import type { Listing, Snapshot } from "../src/lib/types.ts";
import { saveToSupabase } from "./supabase.ts";
import { provinceFor, saveGeoCache } from "./geo.ts";
import { withHistory } from "./history.ts";

const BASE = "https://www.volvocars.com";
const LIST = `${BASE}/nl/inventory/`;
const OUT = new URL("../data/volvo_nl.json", import.meta.url);
const DELAY_MS = 2000;
const MAX_PAGES = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Alle `"car":{"vehicle":{...}}`-objecten uit de React-payload van een pagina halen */
function extractVehicles(html: string): any[] {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map((m) => JSON.parse(m[1]) as string)
    .join("");
  const key = '"car":{"vehicle":';
  const out: any[] = [];
  let from = 0;
  for (;;) {
    const start = chunks.indexOf(key, from);
    if (start < 0) break;
    // Het object begint na '"car":' — zoek de bijhorende sluitaccolade (strings overslaan)
    let i = start + 6;
    let depth = 0;
    let end = -1;
    for (; i < chunks.length; i++) {
      const c = chunks[i];
      if (c === '"') {
        for (i++; chunks[i] !== '"'; i++) if (chunks[i] === "\\") i++;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break;
    try {
      out.push(JSON.parse(chunks.slice(start + 6, end + 1)).vehicle);
    } catch {
      /* onvolledig object: overslaan */
    }
    from = end;
  }
  return out;
}

const FUEL: Record<string, string> = {
  PURE_ELECTRIC: "Elektrisch",
  PLUGIN_HYBRID: "Plug-in hybride",
  PETROL_ELECTRIC_PLUGIN_HYBRID: "Plug-in hybride",
  MILD_HYBRID: "Benzine",
  PETROL: "Benzine",
  PETROL_MILD_HYBRID: "Benzine",
  DIESEL: "Diesel",
};

const nl = (arr: any[] | undefined, field: string) =>
  arr?.find((x) => x.language === "nl")?.[field] ?? arr?.[0]?.[field] ?? null;

function fuelOf(s: any): string {
  const code: string = s.engine?.content?.fuelType?.value ?? "";
  const label: string = s.engine?.content?.fuelType?.formatted ?? "";
  if (FUEL[code]) return FUEL[code];
  if (/plug-?in/i.test(code + label)) return "Plug-in hybride";
  if (/electric|elektr/i.test(code + label) && !/hybrid/i.test(code + label)) return "Elektrisch";
  if (/diesel/i.test(code + label)) return "Diesel";
  return "Benzine";
}

function b2cPrice(v: any): number | null {
  for (const main of v.offerList?.main ?? []) {
    for (const ct of main.customerTypes ?? []) {
      const f = ct.first;
      if (f?.customerType?.id === "B2C" && f?.salesModel?.id === "CASH") return f.priceSummary?.price?.displayPrice?.amount ?? null;
    }
  }
  return null;
}

function b2cToken(v: any): string | null {
  for (const main of v.offerList?.main ?? [])
    for (const ct of main.customerTypes ?? [])
      if (ct.first?.customerType?.id === "B2C") return ct.first?.configuration?.token?.short ?? null;
  return null;
}

async function normalize(v: any, hrefs: Map<string, string>, now: number): Promise<Listing | null> {
  const s = v.specification ?? {};
  const d = v.dealer ?? {};
  const price = Math.round(b2cPrice(v) ?? v.pricePerMarket?.[0]?.msrpAmount ?? 0);
  if (!price || !v.id) return null;
  const msrp = Math.round(v.pricePerMarket?.[0]?.msrpAmount ?? 0) || null;
  const model = s.model?.displayName?.value ?? "Volvo";
  const trim = s.trim?.displayName?.value ?? null;
  const hp = parseInt(s.technicalData?.horsepowerTotal?.formatted ?? "", 10) || null;
  const images: string[] = (s.visualizations?.[0]?.galleries?.exteriorStudioProportional?.images ?? [])
    .map((i: any) => i.default?.transparentUrl)
    .filter(Boolean)
    .map((u: string) => u.replace(/([?&])w=\d+/, "$1w=900"));
  const lat = d.location?.lat ?? null;
  const lon = d.location?.lon ?? null;
  const token = b2cToken(v);
  const url =
    hrefs.get(v.id)?.replace(/\?.*$/, token ? `?token=${token}` : "") ??
    `${LIST}`; // val terug op de lijst als we geen detaillink vonden

  return {
    id: `volvo_nl:${v.id}`,
    source: "volvo_nl",
    sourceId: v.id,
    country: "NL",
    url,
    condition: "new",
    vin: null,
    model,
    title: [model, trim, s.driveline?.content?.displayName?.value].filter(Boolean).join(" "),
    modelYear: Number(s.carKeyExpanded?.modelYear) || null,
    fuel: fuelOf(s),
    powertrain: s.engine?.content?.shortName?.value ?? s.driveline?.content?.displayName?.value ?? null,
    drive: s.driveline?.content?.driveType?.value?.replace(/^E_/, "") ?? null,
    powerHp: hp,
    trim,
    body: null,
    color: s.color?.content?.displayName?.value ?? null,
    interior: s.upholstery?.content?.displayName?.value ?? null,
    transmission: null,
    mileageKm: null,
    listPrice: msrp && msrp > price ? msrp : null,
    price,
    options: [],
    packs: [],
    images,
    dealer: {
      name: nl(d.names, "text") ?? d.doingBusinessAs ?? "Volvo-dealer",
      group: d.doingBusinessAs ?? null,
      street: null,
      zip: null,
      city: nl(d.addresses, "city"),
      phone: null,
      lat,
      lon,
      province: await provinceFor(lat, lon),
    },
    listedAt: null,
    firstSeen: now,
    lastSeen: now,
    previousPrice: null,
  };
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
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ locale: "nl-NL" });
  await page.route("**/*", (route) =>
    ["image", "font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue(),
  );

  const raw: { v: any; hrefs: Map<string, string> }[] = [];
  let pages = 1;
  for (let p = 1; p <= Math.min(pages, MAX_PAGES); p++) {
    await page.goto(`${LIST}?page=${p}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const html = await page.content();
    const vehicles = extractVehicles(html);
    // Detaillinks ("Ontdek meer") per voertuig-id
    const hrefs = new Map<string, string>();
    for (const m of html.matchAll(/href="(?:https:\/\/www\.volvocars\.com)?(\/nl\/shop\/details\/[^"/]+\/([a-z0-9]+)\/[^"]*)"/g)) hrefs.set(m[2], BASE + m[1].replace(/&amp;/g, "&"));
    for (const v of vehicles) raw.push({ v, hrefs });
    if (p === 1) {
      const last = Math.max(1, ...[...html.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1])));
      pages = last;
      console.log(`${pages} pagina's`);
    }
    process.stdout.write(`\rPagina ${p}/${pages} (${raw.length} wagens)`);
    if (!vehicles.length) break;
    await sleep(DELAY_MS);
  }
  console.log();
  await browser.close();

  const byId = new Map<string, Listing>();
  for (const { v, hrefs } of raw) {
    const l = await normalize(v, hrefs, now);
    if (!l) continue;
    byId.set(l.id, withHistory(l, previous.get(l.id), now));
  }
  await saveGeoCache();
  const listings = [...byId.values()];
  if (listings.length < 50) throw new Error(`Slechts ${listings.length} wagens gevonden — afgebroken`);

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify({ updatedAt: now, listings } satisfies Snapshot));
  const added = listings.filter((l) => !previous.has(l.id)).length;
  console.log(`✓ ${listings.length} Nederlandse stockwagens opgeslagen (${added} nieuw)`);
  await saveToSupabase("volvo_nl", listings, now);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
