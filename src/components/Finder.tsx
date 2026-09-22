"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { summarize, type Card } from "@/lib/card";
import { modelSlug } from "@/lib/stats";
import {
  COLOR_FAMILIES,
  colorFamily,
  DRIVE_LABEL,
  NL_PROVINCES,
  PROVINCES,
  distanceKm,
  formatEuro,
} from "@/lib/format";
import { ListingCard } from "./ListingCard";
import { ModelPicker } from "./ModelPicker";
import { SaveSearch } from "./SaveSearch";
import { ExternalSearch } from "./ExternalSearch";
import { DistributionRange } from "./DistributionRange";
import { UpdatedAgo } from "./UpdatedAgo";
import { LocationForm, type Place } from "./LocationForm";
import { useAccount } from "./AccountProvider";
import { clearSavedControls, setSavedControls } from "@/lib/saved-view";
import { HeartIcon } from "./AccountMenu";
import {
  EMPTY_CRITERIA,
  LIST_KEYS,
  fromSearchParams,
  matches,
  matchesSegment,
  toSearchParams,
  trimBase,
  type Criteria,
} from "@/lib/filters";

const PAGE = 24;
const NEW_WINDOW = 48 * 3600_000;

const FUEL_TABS = [
  { key: "all", label: "Alle" },
  { key: "Elektrisch", label: "Elektrisch" },
  { key: "Plug-in hybride", label: "Plug-in hybride" },
  { key: "Benzine", label: "Benzine / mild hybride" },
  { key: "Diesel", label: "Diesel" },
] as const;

const CONDITION_TABS = [
  { key: "all", label: "Alles" },
  { key: "new", label: "Stockwagen" },
  { key: "used", label: "Volvo Selekt" },
] as const;

const DRIVE_SHORT: Record<string, string> = {
  FWD: "Voorwiel",
  RWD: "Achterwiel",
  AWD: "Vierwiel",
};

const SORTS = {
  "price-asc": "Laagste prijs",
  "price-desc": "Hoogste prijs",
  "km-asc": "Laagste kilometerstand",
  "year-desc": "Nieuwste bouwjaar",
  distance: "Dichtst bij mij",
  discount: "Grootste korting",
  newest: "Nieuwst binnen",
} as const;
type SortKey = keyof typeof SORTS;

type Filters = Criteria & { sort: SortKey };
type Panel = "model" | "budget" | "km" | "year" | "fuel" | "drive" | "trim" | "motor" | "packs" | "color" | "place" | "offer" | null;

/** Zet het open paneel meteen onder de bijbehorende knop in de verticale lijst. */
const PANEL_SLOT: Record<Exclude<Panel, null>, string> = {
  model: "order-[2]",
  budget: "order-[4]",
  km: "order-[6]",
  year: "order-[8]",
  fuel: "order-[10]",
  drive: "order-[12]",
  trim: "order-[14]",
  color: "order-[16]",
  place: "order-[18]",
  offer: "order-[20]",
  motor: "order-[22]",
  packs: "order-[24]",
};

const EMPTY: Filters = { ...EMPTY_CRITERIA, sort: "price-asc" };

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  const s = p.get("sort") as SortKey | null;
  return {
    ...fromSearchParams(p),
    sort: s && s in SORTS && s !== "distance" ? s : "price-asc",
  };
}

/**
 * Werk het adres bij zonder de Next-patch op `history.replaceState`.
 * Die patch behandelt een url-wijziging als navigatie en haalt de hele voorraad opnieuw op.
 */
function replaceUrl(url: string) {
  History.prototype.replaceState.call(window.history, window.history.state, "", url);
}

/** Parameters die wij beheren; al de rest (bv. utm_source uit een nieuwsbrief) blijft staan */
const OWN_PARAMS = ["land", "staat", "model", "brandstof", "max", "km", "gereserveerd", "sort", ...LIST_KEYS];

function writeUrl(f: Filters) {
  const params = new URLSearchParams(window.location.search);
  for (const key of OWN_PARAMS) params.delete(key);
  const mine = toSearchParams(f);
  if (f.sort !== "price-asc" && f.sort !== "distance") mine.set("sort", f.sort);
  for (const [key, value] of mine) params.set(key, value);
  const qs = params.toString();
  replaceUrl(qs ? `?${qs}` : window.location.pathname);
}

function countBy<T extends string>(items: Card[], key: (c: Card) => T | T[] | null) {
  const m = new Map<T, number>();
  for (const c of items) {
    const v = key(c);
    for (const x of Array.isArray(v) ? v : v ? [v] : []) m.set(x, (m.get(x) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function bounds(values: number[], step: number) {
  if (!values.length) return { min: 0, max: step };
  const min = Math.floor(Math.min(...values) / step) * step;
  const max = Math.max(min + step, Math.ceil(Math.max(...values) / step) * step);
  return { min, max };
}

function ticksOf(min: number, max: number, n = 5) {
  const raw = Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
  return [...new Set(raw.map((v) => Math.round(v)))];
}

function carYear(c: Card) {
  return c.condition === "used" ? (c.regYear ?? c.year) : c.year;
}

export function Finder({ cards: allCards, updatedAt }: { cards: Card[]; updatedAt: number }) {
  const { favorites, user, ready, requireLogin } = useAccount();
  const resultsRef = useRef<HTMLElement>(null);
  const [f, setF] = useState<Filters>(EMPTY);
  const [shown, setShown] = useState(PAGE);
  const [here, setHere] = useState<Place | null>(null);
  const [askLocation, setAskLocation] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [drawer, setDrawer] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [now, setNow] = useState(0);

  const cards = useMemo(() => allCards.filter((c) => c.country === f.country), [allCards, f.country]);
  const models = useMemo(() => summarize(cards), [cards]);

  useEffect(() => {
    if (!panel && !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (panel) setPanel(null);
      else setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, drawer]);

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  useEffect(() => {
    const t = setTimeout(() => {
      setF(readUrl());
      setNow(Date.now());
      if (new URLSearchParams(window.location.search).get("bewaard") === "1") {
        setOnlySaved(true);
        const params = new URLSearchParams(window.location.search);
        params.delete("bewaard");
        const query = params.toString();
        replaceUrl(query ? `${window.location.pathname}?${query}` : window.location.pathname);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Een klik op het logo of "Bekijk alle auto's" gaat naar dezelfde route: Next vervangt de url,
  // maar de component blijft staan. Zonder dit bleven de oude filters actief.
  const searchKey = useSearchParams().toString();
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setF(readUrl());
    setShown(PAGE);
    setPanel(null);
  }, [searchKey]);

  useEffect(() => {
    setSavedControls({ onlySaved, count: favorites.size }, () => {
      setOnlySaved((value) => !value);
      setShown(PAGE);
    });
  }, [onlySaved, favorites.size]);

  useEffect(() => () => clearSavedControls(), []);
  useEffect(() => {
    if (!now || drawer) return;
    const id = window.setTimeout(() => writeUrl(f), 200);
    return () => window.clearTimeout(id);
  }, [f, now, drawer]);

  const change = (fn: (prev: Filters) => Filters) => {
    setF(fn);
    setShown(PAGE);
  };
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => change((prev) => ({ ...prev, [k]: v }));

  const seedTime = useMemo(() => Math.min(...cards.map((c) => c.firstSeen)), [cards]);
  const isNew = (c: Card) => now > 0 && c.firstSeen > seedTime + 3600_000 && now - c.firstSeen < NEW_WINDOW;

  const base = useMemo(
    () => cards.filter((c) => matchesSegment(c, f)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enkel staat/model/brandstof bepalen de basisset
    [cards, f.country, f.condition, f.model, f.fuel],
  );

  const priceDomain = useMemo(() => bounds(cards.map((c) => c.price), 500), [cards]);
  const kmDomain = useMemo(
    () => bounds(cards.map((c) => c.mileageKm).filter((n): n is number => n != null), 1000),
    [cards],
  );
  const yearDomain = useMemo(
    () => bounds(cards.map(carYear).filter((n): n is number => n != null), 1),
    [cards],
  );

  const results = useMemo(() => {
    const list = base.filter((c) => matches(c, f));
    const dist = (c: Card) =>
      here && c.lat != null && c.lon != null ? distanceKm(here, { lat: c.lat, lon: c.lon }) : Infinity;
    const discount = (c: Card) => (c.listPrice ?? c.price) - c.price;
    const cmp: Record<SortKey, (a: Card, b: Card) => number> = {
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      discount: (a, b) => discount(b) - discount(a) || a.price - b.price,
      newest: (a, b) => b.firstSeen - a.firstSeen || a.price - b.price,
      "year-desc": (a, b) => (carYear(b) ?? 0) - (carYear(a) ?? 0) || a.price - b.price,
      "km-asc": (a, b) => (a.mileageKm ?? 0) - (b.mileageKm ?? 0) || a.price - b.price,
      distance: (a, b) => dist(a) - dist(b) || a.price - b.price,
    };
    return list.sort((a, b) => Number(a.reserved) - Number(b.reserved) || cmp[f.sort](a, b));
  }, [base, f, here]);

  const listed = useMemo(
    () => (onlySaved ? results.filter((c) => favorites.has(c.id)) : results),
    [results, onlySaved, favorites],
  );

  const reservedCount = base.filter((c) => c.reserved).length;
  const provinceOrder = f.country === "NL" ? NL_PROVINCES : PROVINCES;

  function setPlace(p: Place) {
    setHere(p);
    setAskLocation(false);
    set("sort", "distance");
  }

  const inCondition = useMemo(
    () => (f.condition === "all" ? cards : cards.filter((c) => c.condition === f.condition)),
    [cards, f.condition],
  );
  const fuelCounts = useMemo(
    () => Object.fromEntries([["all", inCondition.length], ...countBy(inCondition, (c) => c.fuel)]),
    [inCondition],
  );
  const fuelModels = useMemo(
    () =>
      f.condition === "all" && f.fuel === "all"
        ? models
        : summarize(inCondition.filter((c) => f.fuel === "all" || c.fuel === f.fuel)),
    [inCondition, models, f.condition, f.fuel],
  );

  function selectCondition(condition: Filters["condition"]) {
    change((prev) => {
      const pool = condition === "all" ? cards : cards.filter((c) => c.condition === condition);
      const fuel = prev.fuel === "all" || pool.some((c) => c.fuel === prev.fuel) ? prev.fuel : "all";
      const model =
        prev.model && pool.some((c) => c.model === prev.model && (fuel === "all" || c.fuel === fuel)) ? prev.model : null;
      return {
        ...prev,
        condition,
        fuel,
        model,
        maxKm: condition === "new" ? null : prev.maxKm,
        minKm: condition === "new" ? null : prev.minKm,
      };
    });
  }

  function selectFuel(fuel: string) {
    change((prev) => ({
      ...prev,
      fuel,
      powertrains: [],
      model: prev.model && inCondition.some((c) => c.model === prev.model && (fuel === "all" || c.fuel === fuel)) ? prev.model : null,
    }));
  }

  function clearAll() {
    change((prev) => ({ ...EMPTY, country: prev.country, sort: prev.sort }));
  }

  function togglePanel(next: Panel) {
    setPanel((cur) => (cur === next ? null : next));
  }

  const except = (patch: Partial<Filters>) => base.filter((c) => matches(c, { ...f, ...patch }));
  const priceLow = f.minPrice ?? priceDomain.min;
  const priceHigh = f.maxPrice ?? priceDomain.max;
  const kmLow = f.minKm ?? 0;
  const kmHigh = f.maxKm ?? kmDomain.max;
  const yearLow = f.minYear ?? yearDomain.min;
  const yearHigh = f.maxYear ?? yearDomain.max;

  const chips: { label: string; clear: () => void }[] = [];
  if (f.condition !== "all") chips.push({ label: f.condition === "new" ? "Stockwagen" : "Volvo Selekt", clear: () => selectCondition("all") });
  if (f.model) chips.push({ label: f.model, clear: () => set("model", null) });
  if (f.fuel !== "all") chips.push({ label: FUEL_TABS.find((t) => t.key === f.fuel)?.label ?? f.fuel, clear: () => selectFuel("all") });
  for (const name of f.colors) chips.push({ label: name, clear: () => set("colors", f.colors.filter((x) => x !== name)) });
  for (const name of f.trims) chips.push({ label: name, clear: () => set("trims", f.trims.filter((x) => x !== name)) });
  for (const name of f.powertrains) chips.push({ label: name, clear: () => set("powertrains", f.powertrains.filter((x) => x !== name)) });
  for (const name of f.drives) chips.push({ label: DRIVE_SHORT[name] ?? name, clear: () => set("drives", f.drives.filter((x) => x !== name)) });
  for (const name of f.packs) chips.push({ label: name, clear: () => set("packs", f.packs.filter((x) => x !== name)) });
  for (const name of f.provinces) chips.push({ label: name, clear: () => set("provinces", f.provinces.filter((x) => x !== name)) });
  if (f.minPrice || f.maxPrice)
    chips.push({
      label: `${f.minPrice ? formatEuro(f.minPrice) : "0"} – ${f.maxPrice ? formatEuro(f.maxPrice) : "…"}`,
      clear: () => change((prev) => ({ ...prev, minPrice: null, maxPrice: null })),
    });
  if (f.minKm || f.maxKm)
    chips.push({
      label: `${(f.minKm ?? 0).toLocaleString("nl-BE")} – ${f.maxKm ? f.maxKm.toLocaleString("nl-BE") : "…"} km`,
      clear: () => change((prev) => ({ ...prev, minKm: null, maxKm: null })),
    });
  if (f.minYear || f.maxYear)
    chips.push({
      label: `${f.minYear ?? "…"} – ${f.maxYear ?? "…"}`,
      clear: () => change((prev) => ({ ...prev, minYear: null, maxYear: null })),
    });
  if (f.hideReserved) chips.push({ label: "Zonder gereserveerde", clear: () => set("hideReserved", false) });

  const priceActive = Boolean(f.minPrice || f.maxPrice);
  const kmActive = Boolean(f.minKm || f.maxKm);
  const yearActive = Boolean(f.minYear || f.maxYear);

  function closeDrawer() {
    setDrawer(false);
    setPanel(null);
  }

  return (
    <div>
      <div className="sticky top-3 z-30 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13.5px] text-white"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M2 3.5h12M4 8h8M6.5 12.5h3" strokeLinecap="round" />
            </svg>
            Filters
            {chips.length > 0 && (
              <span className="rounded-full bg-mark px-1.5 py-0.5 text-[11px] font-semibold text-ink">{chips.length}</span>
            )}
          </button>
        </div>
        {chips.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.clear}
                className="flex shrink-0 items-center gap-2 rounded-full bg-ink py-1.5 pr-3 pl-3.5 text-[12.5px] text-white"
              >
                {c.label}
                <span className="text-sm leading-none opacity-60">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {drawer && (
        <button
          type="button"
          aria-label="Filters sluiten"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeDrawer}
        />
      )}

      <div
        className={`sticky top-3 z-30 overflow-hidden rounded-3xl bg-[#f6f6f6] ${
          drawer
            ? "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:flex max-md:w-[min(100%,22.5rem)] max-md:animate-[vev-drawer_200ms_ease-out] max-md:flex-col max-md:overflow-y-auto max-md:rounded-none max-md:shadow-2xl"
            : "max-md:hidden"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e8e6] bg-[#f6f6f6] px-4 py-3 md:hidden">
          <p className="text-[15px] font-semibold">Filters</p>
          <button type="button" onClick={closeDrawer} className="rounded-full bg-white px-3 py-1.5 text-[13px] text-ink">
            Sluiten
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4 md:flex-row md:flex-wrap md:items-center sm:px-5">
          <Pill className="order-[1] md:order-none" label={f.model ?? "Model"} active={Boolean(f.model)} open={panel === "model"} onClick={() => togglePanel("model")} />
          <Pill
            className="order-[3] md:order-none"
            label={priceActive ? `${formatEuro(priceLow)} – ${f.maxPrice ? formatEuro(priceHigh) : "…"}` : "Budget"}
            active={priceActive}
            open={panel === "budget"}
            onClick={() => togglePanel("budget")}
          />
          <Pill
            className="order-[5] md:order-none"
            label={kmActive ? `${Math.round(kmLow / 1000)}k – ${f.maxKm ? Math.round(kmHigh / 1000) + "k" : "…"} km` : "Kilometerstand"}
            active={kmActive}
            open={panel === "km"}
            onClick={() => togglePanel("km")}
          />
          <Pill
            className="order-[7] md:order-none"
            label={yearActive ? `${yearLow}–${f.maxYear ?? "…"}` : "Bouwjaar"}
            active={yearActive}
            open={panel === "year"}
            onClick={() => togglePanel("year")}
          />
          <Pill
            className="order-[9] md:order-none"
            label={f.fuel === "all" ? "Brandstof" : (FUEL_TABS.find((t) => t.key === f.fuel)?.label ?? "Brandstof")}
            active={f.fuel !== "all"}
            open={panel === "fuel"}
            onClick={() => togglePanel("fuel")}
          />
          <Pill
            className="order-[11] md:order-none"
            label={f.drives.length === 1 ? (DRIVE_SHORT[f.drives[0]] ?? "Aandrijving") : f.drives.length ? `${f.drives.length} gekozen` : "Aandrijving"}
            active={f.drives.length > 0}
            open={panel === "drive"}
            onClick={() => togglePanel("drive")}
          />
          <Pill
            className="order-[13] md:order-none"
            label={f.trims.length ? `${f.trims.length} ${f.trims.length === 1 ? "uitvoering" : "uitvoeringen"}` : "Uitvoering"}
            active={f.trims.length > 0}
            open={panel === "trim"}
            onClick={() => togglePanel("trim")}
          />
          <Pill className="order-[15] md:order-none" label={f.colors.length ? `${f.colors.length} ${f.colors.length === 1 ? "kleur" : "kleuren"}` : "Kleur"} active={f.colors.length > 0} open={panel === "color"} onClick={() => togglePanel("color")} />
          <Pill className="order-[17] md:order-none" label={f.provinces.length ? `${f.provinces.length} ${f.provinces.length === 1 ? "provincie" : "provincies"}` : "Locatie"} active={f.provinces.length > 0} open={panel === "place"} onClick={() => togglePanel("place")} />
          <Pill
            className="order-[19] md:order-none"
            label={f.condition === "all" ? "Aanbod" : f.condition === "new" ? "Stockwagen" : "Volvo Selekt"}
            active={f.condition !== "all" || f.hideReserved}
            open={panel === "offer"}
            onClick={() => togglePanel("offer")}
          />
          <Pill className="order-[21] md:order-none" label={f.powertrains.length ? `${f.powertrains.length} motoren` : "Motor"} active={f.powertrains.length > 0} open={panel === "motor"} onClick={() => togglePanel("motor")} />
          <Pill className="order-[23] md:order-none" label={f.packs.length ? `${f.packs.length} pakketten` : "Pakketten"} active={f.packs.length > 0} open={panel === "packs"} onClick={() => togglePanel("packs")} />
          <SavedButton
            className="ml-auto max-md:hidden md:order-none"
            onlySaved={onlySaved}
            count={favorites.size}
            onToggle={() => {
              setOnlySaved((v) => !v);
              setShown(PAGE);
            }}
          />

        {panel && (
          <div
            className={`${PANEL_SLOT[panel]} rounded-2xl bg-white p-2 md:order-last md:mt-1 md:-mx-5 md:w-full md:basis-full md:rounded-none md:border-t md:border-[#e8e8e6] md:bg-transparent md:px-5 md:py-3`}
          >
            {panel === "model" && (
              <ModelPicker
                models={fuelModels}
                selected={f.model}
                onSelect={(model) =>
                  change((prev) => ({
                    ...EMPTY,
                    sort: prev.sort,
                    country: prev.country,
                    condition: prev.condition,
                    fuel: prev.fuel,
                    model,
                  }))
                }
              />
            )}
            {panel === "budget" && (
              <DistributionRange
                title="Budget"
                min={priceDomain.min}
                max={priceDomain.max}
                step={500}
                low={priceLow}
                high={priceHigh}
                values={cards.map((c) => c.price)}
                ticks={ticksOf(priceDomain.min, priceDomain.max)}
                labelMin={formatEuro(priceLow)}
                labelMax={f.maxPrice == null ? `${formatEuro(priceDomain.max)}+` : formatEuro(priceHigh)}
                formatTick={(v) => (v >= 1000 ? `€ ${Math.round(v / 1000)}k` : formatEuro(v))}
                presets={[
                  { label: "tot € 15.000", low: priceDomain.min, high: Math.min(priceDomain.max, 15_000) },
                  { label: "€ 15–25k", low: Math.max(priceDomain.min, 15_000), high: Math.min(priceDomain.max, 25_000) },
                  { label: "€ 25–40k", low: Math.max(priceDomain.min, 25_000), high: Math.min(priceDomain.max, 40_000) },
                  { label: "€ 40k+", low: Math.max(priceDomain.min, 40_000), high: priceDomain.max },
                ].filter((p) => p.high > p.low)}
                onChange={(low, high) =>
                  change((prev) => ({
                    ...prev,
                    minPrice: low <= priceDomain.min ? null : low,
                    maxPrice: high >= priceDomain.max ? null : high,
                  }))
                }
              />
            )}
            {panel === "km" && (
              <DistributionRange
                title="Kilometerstand"
                min={0}
                max={kmDomain.max}
                step={1000}
                low={kmLow}
                high={kmHigh}
                values={cards.map((c) => c.mileageKm ?? 0)}
                ticks={ticksOf(0, kmDomain.max)}
                labelMin={`${kmLow.toLocaleString("nl-BE")} km`}
                labelMax={f.maxKm == null ? `${kmDomain.max.toLocaleString("nl-BE")}+ km` : `${kmHigh.toLocaleString("nl-BE")} km`}
                formatTick={(v) => (v >= kmDomain.max ? `${Math.round(v / 1000)}k+` : v === 0 ? "0" : `${Math.round(v / 1000)}k`)}
                presets={[
                  { label: "tot 50k", low: 0, high: Math.min(kmDomain.max, 50_000) },
                  { label: "50–100k", low: Math.min(kmDomain.max, 50_000), high: Math.min(kmDomain.max, 100_000) },
                  { label: "100–150k", low: Math.min(kmDomain.max, 100_000), high: Math.min(kmDomain.max, 150_000) },
                  { label: "150k+", low: Math.min(kmDomain.max, 150_000), high: kmDomain.max },
                ].filter((p) => p.high > p.low)}
                onChange={(low, high) =>
                  change((prev) => ({
                    ...prev,
                    minKm: low <= 0 ? null : low,
                    maxKm: high >= kmDomain.max ? null : high,
                  }))
                }
              />
            )}
            {panel === "year" && (
              <DistributionRange
                title="Bouwjaar"
                min={yearDomain.min}
                max={yearDomain.max}
                step={1}
                low={yearLow}
                high={yearHigh}
                values={cards.map(carYear).filter((n): n is number => n != null)}
                ticks={ticksOf(yearDomain.min, yearDomain.max)}
                labelMin={String(yearLow)}
                labelMax={String(f.maxYear ?? yearDomain.max)}
                formatTick={(v) => String(v)}
                presets={[
                  { label: "alles", low: yearDomain.min, high: yearDomain.max },
                  { label: "2018+", low: Math.max(yearDomain.min, 2018), high: yearDomain.max },
                  { label: "2021+", low: Math.max(yearDomain.min, 2021), high: yearDomain.max },
                  { label: "2023+", low: Math.max(yearDomain.min, 2023), high: yearDomain.max },
                ].filter((p, i, arr) => p.high > p.low && arr.findIndex((x) => x.low === p.low && x.high === p.high) === i)}
                onChange={(low, high) =>
                  change((prev) => ({
                    ...prev,
                    minYear: low <= yearDomain.min ? null : low,
                    maxYear: high >= yearDomain.max ? null : high,
                  }))
                }
              />
            )}
            {panel === "fuel" && (
              <OptionBlock title="Brandstof">
                {FUEL_TABS.filter((t) => t.key === "all" || fuelCounts[t.key]).map((t) => (
                  <OptionChip
                    key={t.key}
                    label={t.label}
                    count={fuelCounts[t.key] ?? 0}
                    on={f.fuel === t.key}
                    onClick={() => selectFuel(t.key)}
                  />
                ))}
              </OptionBlock>
            )}
            {panel === "drive" && (
              <OptionBlock title="Aandrijving">
                {countBy(except({ drives: [] }), (c) => c.drive).map(([drive, n]) => (
                  <OptionChip
                    key={drive}
                    label={DRIVE_SHORT[drive] ?? DRIVE_LABEL[drive] ?? drive}
                    count={n}
                    on={f.drives.includes(drive)}
                    onClick={() => set("drives", f.drives.includes(drive) ? f.drives.filter((x) => x !== drive) : [...f.drives, drive])}
                  />
                ))}
              </OptionBlock>
            )}
            {panel === "trim" && (
              <OptionBlock title="Uitvoering">
                {countBy(except({ trims: [] }), (c) => trimBase(c.trim)).map(([trim, n]) => (
                  <OptionChip
                    key={trim}
                    label={trim}
                    count={n}
                    on={f.trims.includes(trim)}
                    onClick={() => set("trims", f.trims.includes(trim) ? f.trims.filter((x) => x !== trim) : [...f.trims, trim])}
                  />
                ))}
              </OptionBlock>
            )}
            {panel === "motor" && (
              <OptionBlock title="Motor">
                {countBy(except({ powertrains: [] }), (c) => c.powertrain).map(([name, n]) => (
                  <OptionChip
                    key={name}
                    label={name}
                    count={n}
                    on={f.powertrains.includes(name)}
                    onClick={() =>
                      set("powertrains", f.powertrains.includes(name) ? f.powertrains.filter((x) => x !== name) : [...f.powertrains, name])
                    }
                  />
                ))}
              </OptionBlock>
            )}
            {panel === "packs" && (
              <OptionBlock title="Pakketten">
                {countBy(except({ packs: [] }), (c) => c.packs).map(([name, n]) => (
                  <OptionChip
                    key={name}
                    label={name}
                    count={n}
                    on={f.packs.includes(name)}
                    onClick={() => set("packs", f.packs.includes(name) ? f.packs.filter((x) => x !== name) : [...f.packs, name])}
                  />
                ))}
              </OptionBlock>
            )}
            {panel === "color" && <ColorPanel base={except({ colors: [] })} selected={f.colors} onChange={(v) => set("colors", v)} />}
            {panel === "place" && (
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_1fr] lg:gap-6">
                <div>
                  <div className="mb-2.5 text-sm font-medium">Waar zoek je?</div>
                  <LocationForm country={f.country} onFound={setPlace} />
                  {here && <p className="mt-2 text-xs text-muted">Afstand vanaf {here.label}</p>}
                  {askLocation && !here && <p className="mt-2 text-xs text-muted">Kies een plaats om op afstand te sorteren.</p>}
                </div>
                <div>
                  <div className="mb-2.5 text-sm font-medium">Provincie</div>
                  <div className="flex flex-wrap gap-1.5">
                    {countBy(except({ provinces: [] }), (c) => c.province)
                      .sort((a, b) => provinceOrder.indexOf(a[0]) - provinceOrder.indexOf(b[0]))
                      .map(([name, n]) => (
                        <OptionChip
                          key={name}
                          label={name}
                          count={n}
                          on={f.provinces.includes(name)}
                          onClick={() =>
                            set("provinces", f.provinces.includes(name) ? f.provinces.filter((x) => x !== name) : [...f.provinces, name])
                          }
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}
            {panel === "offer" && (
              <div className="flex flex-col gap-2.5 md:gap-4">
                <OptionBlock title="Aanbod">
                  {CONDITION_TABS.map((t) => (
                    <OptionChip key={t.key} label={t.label} count={cards.filter((c) => t.key === "all" || c.condition === t.key).length} on={f.condition === t.key} onClick={() => selectCondition(t.key)} />
                  ))}
                </OptionBlock>
                {(reservedCount > 0 || f.hideReserved) && (
                  <button
                    type="button"
                    onClick={() => set("hideReserved", !f.hideReserved)}
                    className={`w-fit rounded-full border px-3.5 py-2 text-[13px] ${f.hideReserved ? "border-ink bg-ink text-white" : "border-[#e3e3e3] bg-white"}`}
                  >
                    {f.hideReserved ? "Gereserveerde verborgen" : `Verberg gereserveerde (${reservedCount})`}
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 hidden flex-wrap items-center justify-between gap-3 border-t border-[#eee] pt-3 md:flex">
              <button type="button" onClick={clearAll} className="text-[13.5px] text-[#787878] underline">
                Wis alle filters
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="rounded-full border border-[#d9d9d9] bg-white px-4 py-2 text-[13px] text-ink hover:bg-[#f2f2f2]"
                >
                  Sluiten
                </button>
                <button type="button" onClick={() => setPanel(null)} className="rounded-full bg-ink px-5 py-2 text-[13px] text-white hover:bg-black">
                  Toon {results.length.toLocaleString("nl-BE")} wagens
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-4 sm:px-5">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.clear}
                className="flex items-center gap-2 rounded-full bg-ink py-1.5 pr-3 pl-3.5 text-[12.5px] text-white"
              >
                {c.label}
                <span className="text-sm leading-none opacity-60">×</span>
              </button>
            ))}
            <button type="button" onClick={clearAll} className="ml-1 text-[12.5px] text-[#787878] underline">
              Wis alles
            </button>
          </div>
        )}
        <div className="sticky bottom-0 mt-auto border-t border-[#e8e8e6] bg-[#f6f6f6] p-4 md:hidden">
          <button type="button" onClick={closeDrawer} className="w-full rounded-full bg-ink px-5 py-3 text-[13.5px] text-white">
            Toon {results.length.toLocaleString("nl-BE")} wagens
          </button>
        </div>
      </div>

      <section ref={resultsRef} className="mt-8">
        {onlySaved && (
          <button
            type="button"
            onClick={() => {
              setOnlySaved(false);
              setShown(PAGE);
            }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-white hover:bg-black"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M10 3.5 5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Alle auto&apos;s
          </button>
        )}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-[28px] font-light tracking-tight">
              {listed.length.toLocaleString("nl-BE")} {listed.length === 1 ? "wagen" : "wagens"}
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">
              {f.sort === "distance" && here && (
                <>
                  Vanaf{" "}
                  <button type="button" onClick={() => setPanel("place")} className="underline">
                    {here.label}
                  </button>
                  {" · "}
                </>
              )}
              {f.model && (
                <>
                  <Link href={`/modellen/${modelSlug(f.model)}`} className="underline underline-offset-4">
                    alles over de {f.model}
                  </Link>
                  {" · "}
                </>
              )}
              bijgewerkt <UpdatedAgo at={updatedAt} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[13.5px] text-[#3d3d3d]">
              <span>Sorteren</span>
              <span className="relative">
                <select
                  value={f.sort}
                  onChange={(e) => {
                    const v = e.target.value as SortKey;
                    if (v === "distance" && !here) {
                      setAskLocation(true);
                      setPanel("place");
                    } else set("sort", v);
                  }}
                  className="appearance-none rounded-full border border-[#e3e3e3] bg-white py-2.5 pr-9 pl-3.5 text-[13.5px] text-ink"
                >
                  {Object.entries(SORTS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 6.5 8 10.5 12 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </label>
          </div>
        </div>

        {listed.length === 0 ? (
          onlySaved && ready && !user ? (
            <SavedAccountPrompt onAccount={() => requireLogin("Maak een account om je bewaarde auto's op te slaan.")} onShowAll={() => setOnlySaved(false)} />
          ) : (
            <div className="rounded-[20px] bg-[#f6f6f6] px-10 py-16 text-center">
              <div className="font-serif text-2xl font-light">{onlySaved ? "Geen bewaarde wagens in deze selectie" : "Geen wagens met deze filters"}</div>
              <p className="mt-2 text-sm text-muted">{onlySaved ? "Bewaar een auto met het hartje, of zet de filter uit." : "Verruim je budget, bouwjaar of kilometerstand."}</p>
              <button type="button" onClick={onlySaved ? () => setOnlySaved(false) : clearAll} className="mt-6 rounded-full bg-ink px-6 py-3 text-sm text-white">
                {onlySaved ? "Toon alle wagens" : "Wis alle filters"}
              </button>
            </div>
          )
        ) : (
          <>
            {onlySaved && ready && !user && (
              <div className="mb-6 flex flex-col gap-4 rounded-[20px] bg-mark px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[18px] font-semibold tracking-tight">Maak een account om deze selectie op te slaan</p>
                  <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[#3d3d3d]">
                    {listed.length === 1 ? "Deze auto staat" : "Deze auto's staan"} hier omdat je op het hartje klikte.
                    <br />
                    Zonder account wordt de selectie niet bewaard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => requireLogin("Maak een account om je bewaarde auto's op te slaan.")}
                  className="w-fit shrink-0 rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-white hover:bg-black"
                >
                  Account maken
                </button>
              </div>
            )}
            <div
              className={
                onlySaved
                  ? "grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4"
                  : "grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]"
              }
            >
              {(onlySaved ? listed.slice(0, shown) : withSellCard(listed.slice(0, shown))).map((item) =>
                item === "sell" ? (
                  <SellCard key="sell" />
                ) : (
                  <ListingCard
                    key={item.id}
                    card={item}
                    isNew={isNew(item)}
                    distance={here && item.lat != null && item.lon != null ? distanceKm(here, { lat: item.lat, lon: item.lon }) : null}
                    onSaved={() => {
                      setOnlySaved(true);
                      setShown(PAGE);
                      setPanel(null);
                      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                    }}
                  />
                ),
              )}
            </div>
          </>
        )}

        {shown < listed.length && (
          <div className="mx-auto mt-9 flex max-w-md flex-col items-center gap-3.5">
            <div className="text-[12.5px] text-muted">
              {shown} van {listed.length.toLocaleString("nl-BE")} getoond
            </div>
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="rounded-full border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-white"
            >
              Toon {Math.min(PAGE, listed.length - shown)} meer
            </button>
          </div>
        )}
      </section>

      <section className="mt-16 rounded-[28px] bg-[#f6f6f6] px-6 py-11 sm:px-12">
        <div className="flex flex-wrap items-center justify-between gap-7">
          <div className="max-w-lg">
            <h2 className="font-serif text-[30px] font-light tracking-tight">Nog niet gevonden wat je zoekt?</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#4a4a4a]">
              Bewaar je filters en krijg een mail zodra er een match binnenkomt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <SaveSearch criteria={f} label="Zet meldingen aan" variant="solid" />
            <ExternalSearch criteria={f} />
          </div>
        </div>
      </section>
      {chips.length > 0 && <SaveSearch criteria={f} label="Mail bij deze zoekopdracht" variant="float" />}
    </div>
  );
}

function SavedAccountPrompt({ onAccount, onShowAll }: { onAccount: () => void; onShowAll: () => void }) {
  return (
    <div className="rounded-[20px] bg-[#f6f6f6] px-8 py-14 text-center">
      <div className="font-serif text-[28px] font-light tracking-tight">Maak een account om je selectie op te slaan</div>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[#3d3d3d]">
        Klik op het hartje bij een auto. Die komt hier te staan. Zonder account wordt die selectie niet bewaard.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onAccount} className="rounded-full bg-ink px-6 py-3 text-sm text-white hover:bg-black">
          Account maken
        </button>
        <button type="button" onClick={onShowAll} className="rounded-full border border-[#d9d9d9] bg-white px-6 py-3 text-sm text-ink hover:bg-[#f2f2f2]">
          Toon alle wagens
        </button>
      </div>
    </div>
  );
}

function withSellCard(cars: Card[]): (Card | "sell")[] {
  const at = Math.min(3, cars.length);
  return [...cars.slice(0, at), "sell", ...cars.slice(at)];
}

function SellCard() {
  return (
    <Link
      href="/verkopen"
      className="group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-[#e9e9e9] bg-[#f6f6f6] p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(23,26,24,0.11)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/models/xc60-card.png" alt="" className="pointer-events-none absolute right-0 -bottom-1 w-[80%] max-w-none opacity-40" />
      <span className="relative z-10 grid size-12 place-items-center rounded-full bg-mark text-ink">
        <span className="-translate-y-[3px] text-[28px] leading-none font-light">+</span>
      </span>
      <div className="relative z-10 mt-8 max-w-[15rem]">
        <p className="text-[22px] leading-snug font-semibold tracking-tight">Verkoop je Volvo</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">Zet je auto gratis tussen dit aanbod.</p>
      </div>
      <span className="relative z-10 mt-auto w-fit rounded-full bg-mark px-4 py-2.5 text-[13.5px] font-medium text-ink group-hover:bg-[#e8c52e]">
        Auto toevoegen
      </span>
    </Link>
  );
}

function Pill({
  label,
  active,
  open,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} inline-flex w-full items-center rounded-full border px-4 py-2.5 text-[13.5px] whitespace-nowrap md:w-auto ${
        active ? "border-ink bg-ink text-white" : open ? "border-ink bg-white text-ink" : "border-[#e3e3e3] bg-white text-[#3d3d3d]"
      }`}
    >
      {active && <span className="mr-1.5 text-[12px] text-[#2f9e5e]">✓</span>}
      {label}
      <svg
        className={`ml-auto size-3.5 shrink-0 transition md:ml-2 ${open ? "rotate-180" : ""}`}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M4 6.5 8 10.5 12 6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function OptionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 hidden text-sm font-medium md:block">{title}</div>
      <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">{children}</div>
    </div>
  );
}

function OptionChip({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!count && !on}
      className={`inline-flex items-center rounded-full border px-2.5 py-1.5 text-[12.5px] whitespace-nowrap md:px-3.5 md:py-2 md:text-[13px] ${
        on ? "border-ink bg-ink text-white" : count ? "border-[#e3e3e3] bg-white text-[#3d3d3d]" : "cursor-not-allowed border-[#e3e3e3] text-[#b9b9b9]"
      }`}
    >
      {label}
      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${count ? "bg-mark text-ink" : "bg-[#ececec] text-[#b0b0b0]"}`}>
        {count.toLocaleString("nl-BE")}
      </span>
    </button>
  );
}

function ColorPanel({ base, selected, onChange }: { base: Card[]; selected: string[]; onChange: (v: string[]) => void }) {
  const n = new Map(countBy(base, (c) => colorFamily(c.color)));
  const families = [...COLOR_FAMILIES.map((fam) => ({ name: fam.name, hex: fam.hex })), { name: "Overig", hex: "" }].filter(
    (fam) => n.get(fam.name) || selected.includes(fam.name),
  );
  return (
    <div>
      <div className="mb-2 hidden items-baseline justify-between md:mb-3 md:flex">
        <div className="text-sm font-medium">Kleur</div>
        <div className="text-[12.5px] text-muted">{selected.length ? selected.join(", ") : "alle kleuren"}</div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-8">
        {families.map(({ name, hex }) => {
          const on = selected.includes(name);
          const count = n.get(name) ?? 0;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(on ? selected.filter((x) => x !== name) : [...selected, name])}
              className={`flex items-center gap-1.5 rounded-lg border bg-white px-1.5 py-1.5 text-left md:gap-2 md:rounded-xl md:px-2.5 md:py-2 ${on ? "border-ink shadow-[0_0_0_1px_#171a18]" : "border-[#e9e9e9]"} ${count ? "" : "opacity-45"}`}
            >
              <span
                className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] md:size-[26px]"
                style={{ background: hex || "conic-gradient(#c33, #cc3, #3c6, #36c, #c3c, #c33)" }}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{name}</span>
                <span className="mt-0.5 inline-block rounded-full bg-mark px-1.5 text-[11px] font-medium text-ink">{count}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Knop "toon enkel bewaarde wagens". Staat buiten Finder: anders verliest hij focus bij elke render. */
function SavedButton({
  className = "",
  onlySaved,
  count,
  onToggle,
}: {
  className?: string;
  onlySaved: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={onlySaved}
      aria-label={onlySaved ? "Alle wagens tonen" : "Toon alleen bewaarde auto's"}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#d8232a] px-3 py-2.5 text-[#d8232a] ${onlySaved ? "bg-[#fff6f6]" : "bg-white hover:bg-[#fff6f6]"} ${className}`}
    >
      <HeartIcon filled={onlySaved || count > 0} className="size-4" />
      <span className="rounded-full bg-[#d8232a] px-1.5 py-0.5 text-[11px] font-medium text-white">{count}</span>
    </button>
  );
}
