// "Goede deal"-indicator: hoe verhoudt de prijs van een wagen zich tot de markt?
//
// - Tweedehands: per land + model + brandstof een regressie op log(prijs) met leeftijd, kilometerstand en
//   vermogen. Het verschil tussen de echte en de verwachte prijs bepaalt het label.
// - Nieuw (stock): de prijs t.o.v. de mediaanprijs van dezelfde configuratie (model + motor + uitvoering).
//
// Bewust eenvoudig en uitlegbaar: de detailpagina toont waarmee vergeleken werd.

import { countryOfSource, type Listing } from "./types.ts";

export type DealLabel = "scherp" | "goed" | "markt" | "hoog";

export interface Deal {
  label: DealLabel;
  /** % t.o.v. de referentieprijs (negatief = goedkoper) */
  diff: number;
  kind: "used" | "new";
  /** Verwachte prijs (tweedehands) of mediaanprijs van dezelfde configuratie (nieuw) */
  reference: number;
  peers: number;
}

/** Minimale velden die nodig zijn om een prijs te beoordelen (scheelt data ophalen) */
export type Peer = Pick<
  Listing,
  "id" | "source" | "model" | "price" | "fuel" | "condition" | "mileageKm" | "powerHp" | "trim" | "powertrain"
> &
  Partial<Pick<Listing, "country" | "reserved" | "firstRegistration" | "modelYear">>;

export const DEAL_TEXT: Record<DealLabel, string> = {
  scherp: "Scherpe prijs",
  goed: "Goede prijs",
  markt: "Marktconform",
  hoog: "Boven de markt",
};

const MIN_PEERS = 12;
const MIN_NEW_PEERS = 5;
const DAY = 86_400_000;

function ageYears(l: Peer, now: number) {
  const reg = l.firstRegistration ? Date.parse(l.firstRegistration) : null;
  if (reg) return Math.max(0, (now - reg) / (365.25 * DAY));
  return l.modelYear ? Math.max(0, new Date(now).getFullYear() - l.modelYear) : null;
}

/** Kleinste-kwadraten via normaalvergelijkingen (Gauss-eliminatie); X bevat al een kolom 1'en */
function ols(X: number[][], y: number[]): number[] | null {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let r = 0; r < X.length; r++) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) A[i][j] += X[r][i] * X[r][j];
      A[i][k] += X[r][i] * y[r];
    }
  }
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / row[i]);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const trimBase = (t: string | null) => t?.split(" ")[0] ?? "";
const countryOf = (l: Peer) => l.country ?? countryOfSource(l.source);

/** Regressie op log(prijs) over vergelijkbare tweedehands wagens; geeft de verwachte prijs per wagen */
function usedModel(peers: Peer[], now: number) {
  const rows = peers
    .map((l) => ({ l, age: ageYears(l, now), km: l.mileageKm, hp: l.powerHp }))
    .filter((r): r is typeof r & { age: number; km: number } => r.age != null && r.km != null);
  if (rows.length < MIN_PEERS) return null;
  const hpMedian = median(rows.map((r) => r.hp).filter((h): h is number => h != null)) || 0;
  const x = (r: { age: number; km: number; hp: number | null }) => [1, r.age, r.km / 10_000, (r.hp ?? hpMedian) / 100];
  const beta = ols(rows.map(x), rows.map((r) => Math.log(r.l.price)));
  if (!beta || beta[1] > 0) return null; // oudere wagens horen goedkoper te zijn; zo niet: te weinig signaal
  const expectedFor = (r: { age: number | null; km: number | null; hp: number | null }) =>
    r.age == null || r.km == null ? null : Math.exp(x({ age: r.age, km: r.km, hp: r.hp }).reduce((s, v, i) => s + v * beta[i], 0));
  return { rows, expectedFor, count: rows.length };
}

function labelUsed(diff: number): DealLabel {
  return diff <= -8 ? "scherp" : diff <= -3 ? "goed" : diff <= 5 ? "markt" : "hoog";
}

function labelNew(diff: number): DealLabel {
  return diff <= -6 ? "scherp" : diff <= -2.5 ? "goed" : diff <= 4 ? "markt" : "hoog";
}

/**
 * Prijsoordeel voor één wagen. `candidates` mag ruimer zijn (bv. alle wagens van dat model in dat land):
 * hier wordt de juiste vergelijkingsgroep uitgefilterd, net zoals in computeDeals.
 */
export function dealFor(car: Peer, candidates: Peer[], now = Date.now()): Deal | null {
  if (!car.price) return null;
  const sameCountry = candidates.filter((l) => countryOf(l) === countryOf(car) && l.model === car.model && l.price > 0);

  if (car.condition === "used") {
    if (car.reserved) return null;
    const peers = sameCountry.filter((l) => l.condition === "used" && !l.reserved && l.fuel === car.fuel);
    const fit = usedModel(peers, now);
    const expected = fit?.expectedFor({ age: ageYears(car, now), km: car.mileageKm, hp: car.powerHp });
    if (!fit || !expected) return null;
    const diff = ((car.price - expected) / expected) * 100;
    return { label: labelUsed(diff), diff, kind: "used", reference: Math.round(expected / 50) * 50, peers: fit.count };
  }

  const peers = sameCountry.filter(
    (l) => l.condition === "new" && l.powertrain === car.powertrain && trimBase(l.trim) === trimBase(car.trim),
  );
  if (peers.length < MIN_NEW_PEERS) return null;
  const med = median(peers.map((l) => l.price));
  const diff = ((car.price - med) / med) * 100;
  return { label: labelNew(diff), diff, kind: "new", reference: Math.round(med), peers: peers.length };
}

function group<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return m;
}

export function computeDeals(listings: Listing[], now = Date.now()): Map<string, Deal> {
  const deals = new Map<string, Deal>();
  const country = countryOf;

  // ── Tweedehands ──
  const used = listings.filter((l) => l.condition === "used" && !l.reserved && l.price > 0);
  for (const cars of group(used, (l) => `${country(l)}|${l.model}|${l.fuel}`).values()) {
    const fit = usedModel(cars, now);
    if (!fit) continue;
    for (const r of fit.rows) {
      const expected = fit.expectedFor(r)!;
      const diff = ((r.l.price - expected) / expected) * 100;
      deals.set(r.l.id, { label: labelUsed(diff), diff, kind: "used", reference: Math.round(expected / 50) * 50, peers: fit.count });
    }
  }

  // ── Nieuw op stock: prijs vergelijken met dezelfde configuratie (model + motor + uitvoering) ──
  const fresh = listings.filter((l) => l.condition === "new" && l.price > 0);
  for (const cars of group(fresh, (l) => `${country(l)}|${l.model}|${l.powertrain}|${trimBase(l.trim)}`).values()) {
    if (cars.length < MIN_NEW_PEERS) continue;
    const med = median(cars.map((l) => l.price));
    for (const l of cars) {
      const diff = ((l.price - med) / med) * 100;
      deals.set(l.id, { label: labelNew(diff), diff, kind: "new", reference: Math.round(med), peers: cars.length });
    }
  }
  return deals;
}
