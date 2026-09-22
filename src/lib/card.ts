import { countryOfSource, type Condition, type Country, type Listing, type Source } from "./types";
import { province as beProvince } from "./format";
import type { Deal, DealLabel } from "./deals";

/** Compacte versie van een Listing voor de client (houdt de payload klein). */
/** URL van onze eigen detailpagina voor een wagen */
export function pagePath(l: Pick<Listing, "source" | "sourceId">): string {
  return l.source === "particulier" ? `/particulier/${l.sourceId}` : `/wagen/${l.source}--${encodeURIComponent(l.sourceId)}`;
}

/** Detailpagina van een kaart; afgeleid uit het id, zodat we het pad niet hoeven mee te sturen */
export function cardPath(card: Pick<Card, "id">): string {
  const i = card.id.indexOf(":");
  return pagePath({ source: card.id.slice(0, i) as Listing["source"], sourceId: card.id.slice(i + 1) });
}

export interface Card {
  id: string;
  /** Prijsoordeel t.o.v. de markt (enkel als er genoeg vergelijkbare wagens zijn) */
  deal: { label: DealLabel; diff: number } | null;
  source: Source;
  country: Country;
  condition: Condition;
  model: string;
  year: number | null;
  fuel: string;
  powertrain: string | null;
  drive: string | null;
  hp: number | null;
  trim: string | null;
  color: string | null;
  interior: string | null;
  listPrice: number | null;
  price: number;
  previousPrice: number | null;
  packs: string[];
  image: string | null;
  dealer: string | null;
  city: string | null;
  province: string | null;
  lat: number | null;
  lon: number | null;
  mileageKm: number | null;
  reserved: boolean;
  /** Eigen advertentie van een bedrijf (i.p.v. particulier) */
  business: boolean;
  /** Jaar van eerste inschrijving (tweedehands) */
  regYear: number | null;
  firstSeen: number;
}

export function toCard(l: Listing, deal?: Deal | null): Card {
  const country = l.country ?? countryOfSource(l.source);
  return {
    id: l.id,
    deal: deal ? { label: deal.label, diff: Math.round(deal.diff * 10) / 10 } : null,
    source: l.source,
    country,
    condition: l.condition,
    model: l.model,
    year: l.modelYear,
    fuel: l.fuel,
    powertrain: l.powertrain,
    drive: l.drive,
    hp: l.powerHp,
    trim: l.trim,
    color: l.color,
    interior: l.interior,
    listPrice: l.listPrice,
    price: l.price,
    previousPrice: l.previousPrice,
    packs: l.packs,
    image: l.images[0] ?? null,
    dealer: l.dealer?.name ?? null,
    city: l.dealer?.city ?? null,
    province: l.dealer?.province ?? (country === "BE" ? beProvince(l.dealer?.zip ?? null) : null),
    lat: l.dealer?.lat ?? null,
    lon: l.dealer?.lon ?? null,
    mileageKm: l.mileageKm,
    reserved: Boolean(l.reserved),
    business: l.sellerType === "business",
    regYear: l.firstRegistration ? new Date(l.firstRegistration).getFullYear() : null,
    firstSeen: l.firstSeen,
  };
}

export interface ModelSummary {
  model: string;
  count: number;
  from: number;
  years: string;
  image: string | null;
  fuels: string[];
}

const LIGHT_COLORS = ["Crystal White Pearl", "Vapour Grey", "Aurora Silver", "Bright Dusk", "Cloud Blue"];

export function summarize(cards: Card[]): ModelSummary[] {
  const groups = new Map<string, Card[]>();
  for (const c of cards) groups.set(c.model, [...(groups.get(c.model) ?? []), c]);
  return [...groups.entries()]
    .map(([model, cs]) => {
      const years = [...new Set(cs.map((c) => c.year).filter(Boolean))].sort() as number[];
      // Studiofoto's van nieuwe wagens ogen het rustigst; anders een foto van een tweedehandse
      const studio = cs.filter((c) => c.source === "volvo_be");
      const hero =
        LIGHT_COLORS.map((col) => studio.find((c) => c.color === col && c.image)).find(Boolean) ??
        studio.find((c) => c.image) ??
        cs.find((c) => c.image);
      return {
        model,
        count: cs.length,
        from: Math.min(...cs.map((c) => c.price)),
        years: years.length > 1 ? `${years[0]}–${years.at(-1)}` : String(years[0] ?? ""),
        image: hero?.image ?? null,
        fuels: [...new Set(cs.map((c) => c.fuel))],
      };
    })
    .sort((a, b) => b.count - a.count);
}
