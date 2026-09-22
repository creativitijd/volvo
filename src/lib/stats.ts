import type { Deal } from "./deals";
import { colorFamily } from "./format";
import { countryOfSource, type Country, type Listing } from "./types";

export const modelSlug = (model: string) => model.toLowerCase().replace(/\s+/g, "-");

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

function tally<T extends string>(items: Listing[], key: (l: Listing) => T | null, top = 6) {
  const m = new Map<T, number>();
  for (const l of items) {
    const k = key(l);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

/** Prijsverdeling in banden van €5.000 (of €10.000 boven €80.000) */
function priceBands(items: Listing[]) {
  const band = (p: number) => (p < 80_000 ? Math.floor(p / 5_000) * 5_000 : Math.floor(p / 10_000) * 10_000);
  const m = new Map<number, number>();
  for (const l of items) m.set(band(l.price), (m.get(band(l.price)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([from, count]) => ({ from, to: from + (from < 80_000 ? 5_000 : 10_000), count }));
}

export interface SegmentStats {
  count: number;
  minPrice: number | null;
  medianPrice: number | null;
  maxPrice: number | null;
  /** Nieuw: mediaankorting t.o.v. adviesprijs (%), enkel over wagens met korting-info */
  medianDiscountPct: number | null;
  discounted: number;
  /** Tweedehands: mediaan kilometerstand en leeftijd */
  medianKm: number | null;
  medianAge: number | null;
  goodDeals: number;
  bands: { from: number; to: number; count: number }[];
}

function segment(items: Listing[], deals: Map<string, Deal>, now: number): SegmentStats {
  const prices = items.map((l) => l.price);
  const withList = items.filter((l) => l.listPrice && l.listPrice > 0);
  // Enkel wagens met echte korting: de meeste stockwagens hebben er geen, dan is de mediaan altijd 0
  const discountPct = withList.map((l) => ((l.listPrice! - l.price) / l.listPrice!) * 100).filter((p) => p > 0.5);
  const ages = items
    .map((l) => (l.firstRegistration ? (now - Date.parse(l.firstRegistration)) / (365.25 * 86_400_000) : null))
    .filter((a): a is number => a != null);
  return {
    count: items.length,
    minPrice: prices.length ? Math.min(...prices) : null,
    medianPrice: median(prices),
    maxPrice: prices.length ? Math.max(...prices) : null,
    medianDiscountPct: discountPct.length ? Math.round((median(discountPct) ?? 0) * 10) / 10 : null,
    discounted: discountPct.length,
    medianKm: median(items.map((l) => l.mileageKm).filter((k): k is number => k != null)),
    medianAge: ages.length ? Math.round((median(ages.map((a) => a * 10)) ?? 0)) / 10 : null,
    goodDeals: items.filter((l) => ["scherp", "goed"].includes(deals.get(l.id)?.label ?? "")).length,
    bands: priceBands(items),
  };
}

export interface ModelStats {
  model: string;
  slug: string;
  country: Country;
  total: number;
  fresh: SegmentStats;
  used: SegmentStats;
  fuels: [string, number][];
  colors: [string, number][];
  trims: [string, number][];
  dealers: [string, number][];
  /** Motorversies die nu te koop staan */
  engines: { powertrain: string; fuel: string; hpMin: number | null; hpMax: number | null; count: number; fromPrice: number }[];
  /** Tweedehands: mediaanprijs en -kilometerstand per leeftijdsjaar (min. 3 wagens) */
  ageCurve: { age: number; medianPrice: number; medianKm: number | null; count: number }[];
  /** Beste deals en goedkoopste, voor de kaartjes op de pagina */
  bestDeals: Listing[];
  cheapest: Listing[];
}

export function modelStats(all: Listing[], deals: Map<string, Deal>, model: string, country: Country, now: number): ModelStats {
  const items = all.filter((l) => l.model === model && (l.country ?? countryOfSource(l.source)) === country && !l.reserved);
  const dealScore = (l: Listing) => deals.get(l.id)?.diff ?? Infinity;
  return {
    model,
    slug: modelSlug(model),
    country,
    total: items.length,
    fresh: segment(items.filter((l) => l.condition === "new"), deals, now),
    used: segment(items.filter((l) => l.condition === "used"), deals, now),
    fuels: tally(items, (l) => l.fuel),
    colors: tally(items, (l) => colorFamily(l.color)),
    trims: tally(items, (l) => l.trim?.split(" ")[0] ?? null),
    dealers: tally(items, (l) => (l.source === "particulier" ? null : (l.dealer?.name ?? null)), 5),
    engines: engines(items),
    ageCurve: ageCurve(items.filter((l) => l.condition === "used"), now),
    bestDeals: items
      .filter((l) => ["scherp", "goed"].includes(deals.get(l.id)?.label ?? ""))
      .sort((a, b) => dealScore(a) - dealScore(b))
      .slice(0, 4),
    cheapest: [...items].sort((a, b) => a.price - b.price).slice(0, 4),
  };
}

/** Alle modellen met hun aantallen, voor het overzicht en de statische paden */
export function allModels(all: Listing[]) {
  const m = new Map<string, { model: string; count: number; minPrice: number; countries: Set<Country>; image: string | null }>();
  for (const l of all) {
    if (l.reserved) continue;
    const e = m.get(l.model) ?? { model: l.model, count: 0, minPrice: Infinity, countries: new Set<Country>(), image: null };
    e.count++;
    e.minPrice = Math.min(e.minPrice, l.price);
    e.countries.add(l.country ?? countryOfSource(l.source));
    // Studiofoto van een nieuwe wagen als die er is (rustiger beeld)
    if (l.images[0] && (!e.image || (l.source === "volvo_be" && !e.image.includes("hyperportal")))) e.image = l.images[0];
    m.set(l.model, e);
  }
  return [...m.values()].sort((a, b) => a.model.localeCompare(b.model, "nl", { numeric: true }));
}

function engines(items: Listing[]) {
  const m = new Map<string, Listing[]>();
  for (const l of items) {
    if (!l.powertrain) continue;
    const k = `${l.powertrain}|${l.fuel}`;
    m.set(k, [...(m.get(k) ?? []), l]);
  }
  return [...m.entries()]
    .map(([k, ls]) => {
      const [powertrain, fuel] = k.split("|");
      // Onmogelijke waarden (tikfouten van dealers, bv. een bouwjaar) negeren
      const hps = ls.map((l) => l.powerHp).filter((h): h is number => h != null && h >= 40 && h <= 800);
      return {
        powertrain,
        fuel,
        hpMin: hps.length ? Math.min(...hps) : null,
        hpMax: hps.length ? Math.max(...hps) : null,
        count: ls.length,
        fromPrice: Math.min(...ls.map((l) => l.price)),
      };
    })
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function ageCurve(used: Listing[], now: number) {
  const byAge = new Map<number, Listing[]>();
  for (const l of used) {
    if (!l.firstRegistration) continue;
    const age = Math.floor((now - Date.parse(l.firstRegistration)) / (365.25 * 86_400_000));
    if (age < 0 || age > 12) continue;
    byAge.set(age, [...(byAge.get(age) ?? []), l]);
  }
  return [...byAge.entries()]
    .filter(([, ls]) => ls.length >= 3)
    .sort((a, b) => a[0] - b[0])
    .map(([age, ls]) => ({
      age,
      medianPrice: median(ls.map((l) => l.price))!,
      medianKm: median(ls.map((l) => l.mileageKm).filter((k): k is number => k != null)),
      count: ls.length,
    }));
}
