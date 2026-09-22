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

export interface Market {
  key: number;
  snapshot: Snapshot;
  deals: Map<string, Deal>;
  byId: Map<string, Listing>;
}

// De volledige markt is zwaar (duizenden wagens): per proces hooguit één keer per uur inladen,
// en gelijktijdige aanvragen laten meeliften op dezelfde belofte.
const TTL = 3600_000;
let cache: { at: number; market: Market } | null = null;
let loading: Promise<Market> | null = null;

async function loadMarket(): Promise<Market> {
  const snapshot = await getSnapshot();
  return {
    key: snapshot.updatedAt,
    snapshot,
    deals: computeDeals(snapshot.listings),
    byId: new Map(snapshot.listings.map((l) => [l.id, l])),
  };
}

export async function getMarket(): Promise<Market> {
  if (cache && Date.now() - cache.at < TTL) return cache.market;
  loading ??= loadMarket()
    .then((market) => {
      cache = { at: Date.now(), market };
      return market;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
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
