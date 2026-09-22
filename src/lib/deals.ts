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

export const DEAL_TEXT: Record<DealLabel, string> = {
  scherp: "Scherpe prijs",
  goed: "Goede prijs",
  markt: "Marktconform",
  hoog: "Boven de markt",
};

const MIN_PEERS = 12;
const MIN_NEW_PEERS = 5;
const DAY = 86_400_000;

function ageYears(l: Listing, now: number) {
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

function group<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return m;
}

export function computeDeals(listings: Listing[], now = Date.now()): Map<string, Deal> {
  const deals = new Map<string, Deal>();
  const country = (l: Listing) => l.country ?? countryOfSource(l.source);

  // ── Tweedehands ──
  const used = listings.filter((l) => l.condition === "used" && !l.reserved && l.price > 0);
  for (const cars of group(used, (l) => `${country(l)}|${l.model}|${l.fuel}`).values()) {
    const rows = cars
      .map((l) => ({ l, age: ageYears(l, now), km: l.mileageKm, hp: l.powerHp }))
      .filter((r): r is typeof r & { age: number; km: number } => r.age != null && r.km != null);
    if (rows.length < MIN_PEERS) continue;
    const hpMedian = median(rows.map((r) => r.hp).filter((h): h is number => h != null)) || 0;
    const x = (r: (typeof rows)[number]) => [1, r.age, r.km / 10_000, (r.hp ?? hpMedian) / 100];
    const beta = ols(rows.map(x), rows.map((r) => Math.log(r.l.price)));
    if (!beta || beta[1] > 0) continue; // oudere wagens horen goedkoper te zijn; zo niet: te weinig signaal
    for (const r of rows) {
      const expected = Math.exp(x(r).reduce((s, v, i) => s + v * beta[i], 0));
      const diff = ((r.l.price - expected) / expected) * 100;
      const label: DealLabel = diff <= -8 ? "scherp" : diff <= -3 ? "goed" : diff <= 5 ? "markt" : "hoog";
      deals.set(r.l.id, { label, diff, kind: "used", reference: Math.round(expected / 50) * 50, peers: rows.length });
    }
  }

  // ── Nieuw op stock: prijs vergelijken met dezelfde configuratie (model + motor + uitvoering) ──
  const fresh = listings.filter((l) => l.condition === "new" && l.price > 0);
  const trimBase = (t: string | null) => t?.split(" ")[0] ?? "";
  for (const cars of group(fresh, (l) => `${country(l)}|${l.model}|${l.powertrain}|${trimBase(l.trim)}`).values()) {
    if (cars.length < MIN_NEW_PEERS) continue;
    const med = median(cars.map((l) => l.price));
    for (const l of cars) {
      const diff = ((l.price - med) / med) * 100;
      const label: DealLabel = diff <= -6 ? "scherp" : diff <= -2.5 ? "goed" : diff <= 4 ? "markt" : "hoog";
      deals.set(l.id, { label, diff, kind: "new", reference: Math.round(med), peers: cars.length });
    }
  }
  return deals;
}
