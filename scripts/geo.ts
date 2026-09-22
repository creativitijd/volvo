// Provincie opzoeken voor een dealerlocatie (OpenStreetMap Nominatim, reverse geocoding).
// Resultaten worden bewaard in data/geo-cache.json: elke locatie wordt maar één keer opgevraagd,
// met hooguit één aanvraag per seconde (gebruiksvoorwaarden van Nominatim).

import { readFile, writeFile } from "node:fs/promises";

const CACHE = new URL("../data/geo-cache.json", import.meta.url);
const UA = "FindMyVolvoBot/0.1 (+https://findmyvolvo.eu)";

let cache: Record<string, string | null> | null = null;
let lastCall = 0;

const key = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

export async function provinceFor(lat: number | null, lon: number | null): Promise<string | null> {
  if (lat == null || lon == null) return null;
  const c = await load();
  const k = key(lat, lon);
  if (k in c) return c[k];

  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=5&accept-language=nl`,
      { headers: { "user-agent": UA } },
    );
    const json = res.ok ? await res.json() : null;
    c[k] = json?.address?.state ?? json?.address?.province ?? null;
  } catch {
    return null; // niet cachen: volgende run opnieuw proberen
  }
  return c[k];
}

export async function saveGeoCache() {
  if (cache) await writeFile(CACHE, JSON.stringify(cache, null, 0));
}
