import "server-only";
import { getSnapshot } from "./data";
import { computeDeals, type Deal } from "./deals";
import { countryOfSource, type Listing, type Snapshot } from "./types";
export { pagePath } from "./card";

/** Omgekeerd: "volvo_selekt--abc" → listing-id "volvo_selekt:abc" */
export function idFromSlug(slug: string): string | null {
  const s = decodeURIComponent(slug);
  const i = s.indexOf("--");
  return i > 0 ? `${s.slice(0, i)}:${s.slice(i + 2)}` : null;
}

// Deals één keer per snapshot berekenen (de regressie loopt over duizenden wagens)
let cache: { key: number; count: number; snapshot: Snapshot; deals: Map<string, Deal>; byId: Map<string, Listing> } | null = null;

export async function getMarket() {
  const snapshot = await getSnapshot();
  if (!cache || cache.key !== snapshot.updatedAt || cache.count !== snapshot.listings.length) {
    cache = {
      key: snapshot.updatedAt,
      count: snapshot.listings.length,
      snapshot,
      deals: computeDeals(snapshot.listings),
      byId: new Map(snapshot.listings.map((l) => [l.id, l])),
    };
  }
  return cache;
}

/** Vergelijkbare wagens: zelfde land, staat en model; dichtst bij in prijs (en kilometerstand bij tweedehands) */
export function similarTo(l: Listing, all: Listing[], n = 4): Listing[] {
  const country = (x: Listing) => x.country ?? countryOfSource(x.source);
  return all
    .filter((o) => o.id !== l.id && o.model === l.model && o.condition === l.condition && country(o) === country(l) && !o.reserved)
    .map((o) => ({
      o,
      score:
        Math.abs(o.price - l.price) / l.price +
        (l.mileageKm != null && o.mileageKm != null ? Math.abs(o.mileageKm - l.mileageKm) / 100_000 : 0) +
        (o.fuel === l.fuel ? 0 : 0.3),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => x.o);
}
