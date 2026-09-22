// Gedeelde filterlogica: gebruikt door de website (Finder) én door de e-mailmeldingen (scripts/send-alerts.ts),
// zodat een melding exact dezelfde wagens vindt als de zoekopdracht op de site.

import { colorFamily, formatEuro } from "./format.ts";

export interface Criteria {
  country: "BE" | "NL";
  condition: "all" | "new" | "used";
  model: string | null;
  fuel: string; // "all" | "Elektrisch" | "Plug-in hybride" | "Benzine"
  /** Kleurfamilies ("Zwart", "Blauw", ...), niet de exacte lakkleur */
  colors: string[];
  trims: string[];
  powertrains: string[];
  drives: string[];
  packs: string[];
  provinces: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minKm: number | null;
  maxKm: number | null;
  minYear: number | null;
  maxYear: number | null;
  /** Gereserveerde wagens verbergen */
  hideReserved: boolean;
}

export const EMPTY_CRITERIA: Criteria = {
  country: "BE",
  condition: "all",
  model: null,
  fuel: "all",
  colors: [],
  trims: [],
  powertrains: [],
  drives: [],
  packs: [],
  provinces: [],
  minPrice: null,
  maxPrice: null,
  minKm: null,
  maxKm: null,
  minYear: null,
  maxYear: null,
  hideReserved: false,
};

export const LIST_KEYS = ["colors", "trims", "powertrains", "drives", "packs", "provinces"] as const;

export const FUEL_LABEL: Record<string, string> = {
  all: "Alle",
  Elektrisch: "Elektrisch",
  "Plug-in hybride": "Plug-in hybride",
  Benzine: "Benzine / mild hybride",
  Diesel: "Diesel",
};

export const CONDITION_LABEL: Record<Criteria["condition"], string> = {
  all: "Nieuw & tweedehands",
  new: "Stockwagen",
  used: "Volvo Selekt",
};

/** Basisuitvoering zonder editienaam: "Plus Business Edition" → "Plus" */
export const trimBase = (t: string | null) => t?.split(" ")[0] ?? "Overig";

/** Minimale velden die nodig zijn om een wagen te matchen */
export interface Matchable {
  country: "BE" | "NL";
  province: string | null;
  condition: "new" | "used";
  mileageKm: number | null;
  reserved: boolean;
  model: string;
  fuel: string;
  color: string | null;
  trim: string | null;
  powertrain: string | null;
  drive: string | null;
  packs: string[];
  price: number;
  year: number | null;
  regYear: number | null;
}

export function matchesSegment(c: Matchable, f: Criteria) {
  return (
    c.country === (f.country ?? "BE") &&
    (f.condition === "all" || c.condition === f.condition) &&
    (!f.model || c.model === f.model) &&
    (f.fuel === "all" || c.fuel === f.fuel)
  );
}

export function matches(c: Matchable, f: Criteria) {
  const has = (sel: string[], v: string | null) => !sel.length || (v != null && sel.includes(v));
  return (
    matchesSegment(c, f) &&
    has(f.colors, colorFamily(c.color)) &&
    has(f.trims, trimBase(c.trim)) &&
    has(f.powertrains, c.powertrain) &&
    has(f.drives, c.drive) &&
    has(f.provinces, c.province) &&
    f.packs.every((p) => c.packs.includes(p)) &&
    (!f.minPrice || c.price >= f.minPrice) &&
    (!f.maxPrice || c.price <= f.maxPrice) &&
    (!f.minKm || (c.mileageKm ?? 0) >= f.minKm) &&
    (!f.maxKm || (c.mileageKm ?? 0) <= f.maxKm) &&
    yearOk(c, f) &&
    !(f.hideReserved && c.reserved)
  );
}

function shownYear(c: Matchable) {
  return c.condition === "used" ? (c.regYear ?? c.year) : c.year;
}

function yearOk(c: Matchable, f: Criteria) {
  if (!f.minYear && !f.maxYear) return true;
  const y = shownYear(c);
  if (y == null) return false;
  return (!f.minYear || y >= f.minYear) && (!f.maxYear || y <= f.maxYear);
}

/** Enkel de zoekcriteria (zonder sortering e.d.) */
export function pickCriteria(f: Criteria): Criteria {
  return {
    country: f.country,
    condition: f.condition,
    model: f.model,
    fuel: f.fuel,
    colors: f.colors,
    trims: f.trims,
    powertrains: f.powertrains,
    drives: f.drives,
    packs: f.packs,
    provinces: f.provinces,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minKm: f.minKm,
    maxKm: f.maxKm,
    minYear: f.minYear,
    maxYear: f.maxYear,
    hideReserved: f.hideReserved,
  };
}

/** Leesbare samenvatting, bv. "XC60 · Plug-in hybride · Onyx Black · tot € 60.000" */
export function describe(f: Criteria): string {
  const parts = [
    f.country === "NL" ? "Nederland" : null,
    f.condition !== "all" ? CONDITION_LABEL[f.condition] : null,
    f.model ?? "Alle modellen",
    f.fuel !== "all" ? FUEL_LABEL[f.fuel] : null,
    ...f.colors,
    ...f.trims,
    ...f.powertrains,
    ...f.drives,
    ...f.packs,
    ...f.provinces,
    f.minPrice || f.maxPrice
      ? [f.minPrice ? formatEuro(f.minPrice) : null, f.maxPrice ? formatEuro(f.maxPrice) : null].filter(Boolean).join(" – ")
      : null,
    f.minKm || f.maxKm
      ? `${(f.minKm ?? 0).toLocaleString("nl-BE")} – ${f.maxKm ? f.maxKm.toLocaleString("nl-BE") : "…"} km`
      : null,
    f.minYear || f.maxYear ? `${f.minYear ?? "…"} – ${f.maxYear ?? "…"}` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Querystring voor de site, zodat een melding naar exact dezelfde zoekopdracht linkt */
export function toSearchParams(f: Criteria): URLSearchParams {
  const p = new URLSearchParams();
  if (f.country === "NL") p.set("land", "nl");
  if (f.condition !== "all") p.set("staat", f.condition === "new" ? "nieuw" : "tweedehands");
  if (f.model) p.set("model", f.model);
  if (f.fuel !== "all") p.set("brandstof", f.fuel);
  for (const k of LIST_KEYS) if (f[k].length) p.set(k, f[k].join(","));
  if (f.minPrice) p.set("van", String(f.minPrice));
  if (f.maxPrice) p.set("max", String(f.maxPrice));
  if (f.minKm) p.set("kmvan", String(f.minKm));
  if (f.maxKm) p.set("km", String(f.maxKm));
  if (f.minYear) p.set("vanaf", String(f.minYear));
  if (f.maxYear) p.set("totjaar", String(f.maxYear));
  if (f.hideReserved) p.set("gereserveerd", "nee");
  return p;
}

export function fromSearchParams(p: URLSearchParams): Criteria {
  const f: Criteria = { ...EMPTY_CRITERIA };
  f.country = p.get("land")?.toLowerCase() === "nl" ? "NL" : "BE";
  const staat = p.get("staat");
  f.condition = staat === "nieuw" ? "new" : staat === "tweedehands" ? "used" : "all";
  f.model = p.get("model");
  f.fuel = p.get("brandstof") ?? "all";
  for (const k of LIST_KEYS) f[k] = p.get(k)?.split(",").filter(Boolean) ?? [];
  f.minPrice = Number(p.get("van")) || null;
  f.maxPrice = Number(p.get("max")) || null;
  f.minKm = Number(p.get("kmvan")) || null;
  f.maxKm = Number(p.get("km")) || null;
  f.minYear = Number(p.get("vanaf")) || null;
  f.maxYear = Number(p.get("totjaar")) || null;
  f.hideReserved = p.get("gereserveerd") === "nee";
  return f;
}

/**
 * Criteria uit de database (of een oudere versie van de site) naar een geldige vorm brengen.
 * Alles wordt in de browser ingevuld, maar iemand kan ook rechtstreeks naar de API schrijven:
 * zonder deze controle laat één kapotte melding de hele mailronde vastlopen.
 */
export function sanitizeCriteria(raw: unknown): Criteria {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : []);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const f: Criteria = { ...EMPTY_CRITERIA };
  f.country = o.country === "NL" ? "NL" : "BE";
  f.condition = o.condition === "new" || o.condition === "used" ? o.condition : "all";
  f.model = typeof o.model === "string" ? o.model : null;
  f.fuel = typeof o.fuel === "string" ? o.fuel : "all";
  for (const k of LIST_KEYS) f[k] = list(o[k]);
  f.maxPrice = num(o.maxPrice);
  f.maxKm = num(o.maxKm);
  f.hideReserved = o.hideReserved === true;
  return f;
}
