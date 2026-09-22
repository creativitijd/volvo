/* eslint-disable @typescript-eslint/no-explicit-any -- ruwe JSON van externe bronnen */
// Scraper voor Volvo Selekt België (officiële tweedehands Volvo's, selekt.volvocars.be).
// Gebruik: node scripts/scrape-selekt.ts [--market=be|nl] [--max=150] [--minutes=12] [--concurrency=1] [--stale-hours=120]
//
// Werkwijze (binnen de robots.txt van de site):
// 1. sitemap.xml → lijst van alle wagens (elke wagen heeft een eigen pagina).
// 2. Enkel NIEUWE wagens + een beperkt aantal bestaande (voor prijswijzigingen) worden geopend.
//    De pagina's worden geladen in een echte browser (Chrome via Playwright), omdat de site de
//    gegevens pas in de browser ophaalt. We lezen de JSON die de pagina zelf ontvangt.
// 3. Wagens die niet meer in de sitemap staan, zijn verkocht en verdwijnen.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import type { Listing, Snapshot } from "../src/lib/types.ts";
import { saveToSupabase } from "./supabase.ts";
import { provinceFor, saveGeoCache } from "./geo.ts";
import { withHistory } from "./history.ts";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

/** België en Nederland draaien op hetzelfde Selekt-platform (Codeweavers), enkel domein en taalpad verschillen */
const MARKETS = {
  be: { base: "https://selekt.volvocars.be", path: "nl-be", source: "volvo_selekt", country: "BE", locale: "nl-BE" },
  nl: { base: "https://selekt.volvocars.nl", path: "nl-nl", source: "volvo_selekt_nl", country: "NL", locale: "nl-NL" },
} as const;
const MARKET = MARKETS[(arg("market") ?? "be") as keyof typeof MARKETS];
if (!MARKET) throw new Error("--market moet be of nl zijn");
const BASE = MARKET.base;
const OUT = new URL(`../data/${MARKET.source}.json`, import.meta.url);
const CONCURRENCY = Math.max(1, Math.min(4, Number(arg("concurrency") ?? 1)));
const MAX_RENDER = Number(arg("max") ?? 150);
const DELAY_MS = 1500;
/** Maximale looptijd per run (GitHub Actions) */
const MAX_MINUTES = Number(arg("minutes") ?? 12);
/**
 * Bestaande wagens worden na zoveel uur opnieuw geopend (prijswijzigingen). Beschikbaarheid volgt
 * dagelijks uit de sitemap, dus dit hoeft niet elke dag voor elke wagen.
 */
const REFRESH_AFTER_H = Number(arg("stale-hours") ?? 24 * 5);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sitemapIds(): Promise<string[]> {
  const res = await fetch(`${BASE}/sitemap.xml`, { headers: { "user-agent": "VindEenVolvoBot/0.1 (+https://vindeenvolvo.be)" } });
  if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  const prefix = `${BASE}/${MARKET.path}/store/all/vehicles/`;
  const ids = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(prefix)).map((u) => u.slice(prefix.length));
  return [...new Set(ids)];
}

// ── Normalisatie ────────────────────────────────────────────────────────────

/** Uitvoeringen; "Black Edition", "Dark", "Business" zijn edities bovenop een uitvoering */
const TRIMS = ["Core", "Plus", "Ultra", "Ultimate", "Essential", "Momentum", "Inscription", "R-Design", "Kinetic", "Summum", "Pro", "Start", "Base"];

const FUEL: [RegExp, string][] = [
  [/plug-?in/i, "Plug-in hybride"],
  [/^electric|^elektr/i, "Elektrisch"],
  [/diesel/i, "Diesel"],
  [/petrol|benzine/i, "Benzine"],
];

const DRIVE: [RegExp, string][] = [
  [/front/i, "FWD"],
  [/rear/i, "RWD"],
  [/all|four|4/i, "AWD"],
];

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

function normalizeModel(raw: string): string {
  const cc = /cross\s*country/i.test(raw) ? " Cross Country" : "";
  const base = raw.match(/\b([A-Z]{1,2}\d{2})\b/)?.[1] ?? raw.trim();
  return base + cc;
}

function splitVariant(variant: string): { trim: string | null; powertrain: string | null; title: string } {
  // Dealers schrijven de variant zelf, bv. "672411 | Core, B3 Mild-hybride (MHEV), Benzine + Leder + ..."
  const clean = variant.replace(/^\s*\d+\s*\|\s*/, "").trim();
  // Uitvoering: de eerste (op positie) uit de lijst; "Black Edition"/"Dark" zijn edities, geen uitvoering
  let trim: string | null = null;
  let at = Infinity;
  for (const t of TRIMS) {
    const m = new RegExp(`\\b${t}\\b`, "i").exec(clean);
    if (m && m.index < at) {
      at = m.index;
      trim = t;
    }
  }
  return { trim, powertrain: powertrainOf(clean), title: clean };
}

/** Motorcode uit vrije tekst: "B3", "T6 AWD", "T8 AWD", "Single Motor Extended Range", "Twin Motor", "P10" … */
export function powertrainOf(text: string): string | null {
  const ev = text.match(/\b(Single Motor Extended Range|Single Motor|Twin Motor Performance|Twin Motor|P1[0-9]|P[5-9])\b/i);
  const ice = text.match(/\b([BTD][1-8])\b(\s+AWD)?/);
  if (ice) return `${ice[1]}${ice[2] ? " AWD" : ""}`;
  if (ev) return ev[1].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return null;
}

/** Door dealers vrij ingevulde varianten → officiële Volvo-kleurnaam */
const COLOR_ALIASES: [RegExp, string][] = [
  [/^(solid black|black solid.*|black stone.*|black)$/i, "Black Stone"],
  [/^(noir onyx|onyx|onyx black.*)$/i, "Onyx Black"],
  [/vapou?r grey/i, "Vapour Grey"],
  [/^mulberry( red)?$/i, "Mulberry Red"],
  [/^ice white.*$/i, "Ice White"],
  [/^cloud blue.*$/i, "Cloud Blue"],
];

export function cleanColor(c: string | null | undefined): string | null {
  const base = cleanColorBase(c);
  // Interieurcodes die per vergissing als kleur ingevuld zijn ("R31000", "Rb0000") of lege streepjes
  if (!base || /^[A-Z]{1,2}[0-9A-Z]{3,5}$/i.test(base) && /\d/.test(base) || /^[-–.\s]*$/.test(base)) return null;
  const stripped = base.replace(/,?\s*(solid|metallic)$/i, "").trim();
  return COLOR_ALIASES.find(([re]) => re.test(stripped))?.[1] ?? stripped;
}

function cleanColorBase(c: string | null | undefined): string | null {
  if (!c) return null;
  return (
    c
      .replace(/\s*\(\d+\)\s*$/, "") // "Onyx Black (717)"
      .replace(/^(exclusive\s+)?(niet-|non[\s-])?(metaalkleur|metallic|m[ée]tallis[ée]e|peinture\s+m[ée]tallis[ée]e|peinture|pastel|parelmoer)\s+/i, "")
      .replace(/^exclusive\s+/i, "")
      .replace(/^\d{3,}\s+/, "") // "723 Denim Blue"
      .trim()
      .replace(/(^|[\s-])\p{Ll}/gu, (c) => c.toUpperCase()) || null // "Vapour grey" → "Vapour Grey"
  );
}

/** Opschoning die ook op eerder opgeslagen wagens toegepast kan worden */
function refine(l: Listing): Listing {
  const variant = l.title.startsWith(l.model) ? l.title.slice(l.model.length) : l.title;
  const { trim, powertrain } = splitVariant(variant);
  const hp = l.powerHp != null && l.powerHp >= 40 && l.powerHp <= 800 ? l.powerHp : null; // tikfouten weg
  return { ...l, color: cleanColor(l.color), trim: trim ?? l.trim, powertrain, powerHp: hp };
}

export function normalize(id: string, v: any, now: number): Listing | null {
  const d = v?.Vehicle?.Details;
  if (!d) return null;
  const p = d.Physical ?? {};
  const s = d.Specification ?? {};
  const r = d.Retailer ?? {};
  if (p.NoLongerAvailable) return null;

  const model = normalizeModel(s.Model ?? "");
  const { trim, powertrain, title } = splitVariant(s.Variant ?? "");
  const fuelRaw: string = s.FuelType ?? "";
  const fuel = FUEL.find(([re]) => re.test(fuelRaw))?.[1] ?? (fuelRaw || "Onbekend");
  // Variantnaam ("T6 AWD") is betrouwbaarder dan het aandrijvingsveld
  const drive = /\bAWD\b/.test(s.Variant ?? "") ? "AWD" : (DRIVE.find(([re]) => re.test(s.Drive ?? ""))?.[1] ?? null);
  const addr = r.Address ?? {};
  const price = Math.round(p.OnTheRoadPrice ?? s.OnTheRoadPrice ?? 0);
  if (!price) return null;

  return {
    id: `${MARKET.source}:${id}`,
    source: MARKET.source,
    country: MARKET.country,
    sourceId: id,
    url: `${BASE}/${MARKET.path}/store/all/vehicles/${id}`,
    condition: "used",
    vin: p.Vin ?? null,
    model,
    title: `${model} ${title}`.trim(),
    modelYear: s.ModelYear || null,
    fuel,
    powertrain,
    drive,
    powerHp: s.BrakeHorsePower || s.EnginePower?.Value || null,
    trim,
    body: s.BodyStyle ?? p.BodyStyle ?? null,
    color: cleanColor(p.ExteriorColour?.Description),
    interior: p.InteriorColour?.Description?.replace(/\s*\([^)]*\)\s*$/, "").trim() || null,
    transmission: s.Transmission === "Automatic" ? "Automaat" : s.Transmission === "Manual" ? "Manueel" : (s.Transmission ?? null),
    mileageKm: p.Mileage ?? null,
    firstRegistration: p.Registration?.DateRegisteredWithDvla ?? null,
    listPrice: null,
    price,
    options: (p.EquipmentOptions ?? []).map((o: any) => o.Name).filter(Boolean),
    packs: [],
    // Zonder prefix levert de beeldserver 640×480 (±30 kB) i.p.v. 1400×1050 (xxl_)
    images: (d.Images ?? []).slice(0, 6).map((i: any) => String(i.Url).replace(/\/xxl_/, "/")),
    dealer: {
      name: r.TradingName || r.Name || "Volvo Selekt",
      group: r.Groups?.[0]?.Name ?? null,
      street: addr.Line1 ?? null,
      zip: addr.Postcode ?? null,
      city: addr.TownCity ? titleCase(addr.TownCity) : null,
      phone: r.Contacts?.find?.((c: any) => /phone|tel/i.test(c.Type ?? ""))?.Value ?? null,
      lat: addr.Location?.Latitude ?? null,
      lon: addr.Location?.Longitude ?? null,
    },
    reserved: Boolean(p.IsReserved),
    listedAt: p.DateRetailerReceivedVehicle ? Date.parse(p.DateRetailerReceivedVehicle) : null,
    firstSeen: now,
    lastSeen: now,
    previousPrice: null,
  };
}

// ── Browser ─────────────────────────────────────────────────────────────────

/** Alles wat we niet nodig hebben blokkeren: sneller en lichter voor hun servers */
const BLOCK = /(google|doubleclick|clarity|nr-data|newrelic|onetrust|cookielaw|medallia|smartsupp|facebook|hotjar)|\/api\/(finance|proposals\/|vehicleimages|vehicles\/by-reference)/i;

async function fetchVehicle(page: Page, id: string): Promise<any | null> {
  // De pagina roept dezelfde URL twee keer aan; we wachten op het antwoord mét voertuiggegevens
  let resolve: (v: any) => void;
  const found = new Promise<any>((r) => (resolve = r));
  const onResponse = async (r: import("playwright-core").Response) => {
    if (!r.url().includes("/vehicle-details-page/") || r.status() !== 200) return;
    const json = await r.json().catch(() => null);
    if (json?.Vehicle?.Details) resolve(json);
  };
  page.on("response", onResponse);
  try {
    await page.goto(`${BASE}/${MARKET.path}/store/all/vehicles/${id}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    return await Promise.race([found, sleep(30_000).then(() => null)]);
  } finally {
    page.off("response", onResponse);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function loadPrevious(): Promise<Map<string, Listing & { fetchedAt?: number }>> {
  // In CI bestaat het lokale bestand niet: dan is Supabase de bron van waarheid
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const map = new Map<string, Listing & { fetchedAt?: number }>();
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${url}/rest/v1/listings?select=data&source=eq.${MARKET.source}&active=eq.true&order=id`, {
        headers: { apikey: key, authorization: `Bearer ${key}`, range: `${from}-${from + 999}` },
      });
      if (!res.ok) throw new Error(`Supabase: ${res.status} ${await res.text()}`);
      const rows: { data: Listing }[] = await res.json();
      for (const r of rows) map.set(r.data.sourceId, r.data);
      if (rows.length < 1000) break;
    }
    return map;
  }
  try {
    const snap: Snapshot = JSON.parse(await readFile(OUT, "utf8"));
    return new Map(snap.listings.map((l) => [l.sourceId, l]));
  } catch {
    return new Map();
  }
}

async function main() {
  const now = Date.now();
  const ids = await sitemapIds();
  if (ids.length < 50) throw new Error(`Slechts ${ids.length} wagens in de sitemap — afgebroken`);
  const previous = await loadPrevious();

  const fresh = ids.filter((id) => !previous.has(id));
  const stale = ids
    .filter((id) => previous.has(id))
    .map((id) => previous.get(id)!)
    .filter((l) => now - ((l as any).fetchedAt ?? 0) > REFRESH_AFTER_H * 3600_000)
    .sort((a, b) => ((a as any).fetchedAt ?? 0) - ((b as any).fetchedAt ?? 0))
    .map((l) => l.sourceId);
  const queue = [...fresh, ...stale].slice(0, MAX_RENDER);
  console.log(`${ids.length} wagens in sitemap · ${fresh.length} nieuw · ${stale.length} te verversen · ${queue.length} nu openen`);

  const results = new Map<string, Listing & { fetchedAt?: number }>();

  // Samenvoegen: de sitemap bepaalt wat er nog is
  const merge = (): Listing[] => {
    const out: Listing[] = [];
    for (const id of ids) {
      const prev = previous.get(id);
      const cur = results.has(id) ? results.get(id) : prev;
      if (!cur) continue; // nog nooit succesvol geopend, of niet meer beschikbaar
      // Enkel bij een vers geopende wagen de historiek bijwerken; anders blijft de vorige versie staan
      const fresh = results.get(id);
      const merged: Listing & { fetchedAt?: number } = fresh ? withHistory(fresh, prev, now) : { ...cur };
      merged.lastSeen = now;
      if (fresh) merged.fetchedAt = fresh.fetchedAt;
      out.push(refine(merged));
    }
    return out;
  };
  const persist = async (listings: Listing[]) => {
    await mkdir(new URL("../data/", import.meta.url), { recursive: true });
    await writeFile(OUT, JSON.stringify({ updatedAt: now, listings } satisfies Snapshot));
  };
  const deadline = now + MAX_MINUTES * 60_000;
  if (queue.length) {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    // Een paar tabbladen tegelijk (standaard 1); elk tabblad pauzeert tussen twee wagens
    const pages = await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const page = await browser.newPage({ locale: MARKET.locale });
        await page.route("**/*", (route) => {
          const req = route.request();
          if (["image", "font", "media"].includes(req.resourceType()) || BLOCK.test(req.url())) return route.abort();
          return route.continue();
        });
        return page;
      }),
    );

    let ok = 0;
    let done = 0;
    let next = 0;
    let stop = false;
    await Promise.all(
      pages.map(async (page) => {
        while (!stop && next < queue.length) {
          const id = queue[next++];
          try {
            const json = await fetchVehicle(page, id);
            const l = json && normalize(id, json, now);
            if (l) {
              if (MARKET.country === "NL" && l.dealer) l.dealer.province = await provinceFor(l.dealer.lat, l.dealer.lon);
              results.set(id, { ...l, fetchedAt: now });
              ok++;
            } else if (json) {
              results.set(id, null as never); // niet meer beschikbaar
            }
          } catch (e) {
            console.warn(`\n${id}: ${(e as Error).message}`);
          }
          done++;
          process.stdout.write(`\rOpenen ${done}/${queue.length} (${ok} ok)`);
          if (done % 25 === 0) await persist(merge()); // tussentijds bewaren
          if (Date.now() > deadline && !stop) {
            stop = true;
            console.log(`\nTijdslimiet van ${MAX_MINUTES} min bereikt — de rest volgt bij de volgende run`);
          }
          await sleep(DELAY_MS);
        }
      }),
    );
    console.log();
    await browser.close();
  }

  const listings = merge();
  await persist(listings);
  const removed = [...previous.keys()].filter((id) => !ids.includes(id)).length;
  console.log(`✓ ${listings.length} tweedehands wagens (${MARKET.country}) opgeslagen (${removed} verdwenen)`);

  await saveGeoCache();
  await saveToSupabase(MARKET.source, listings, now);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
