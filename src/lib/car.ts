import "server-only";
import { dealFor, type Deal, type Peer } from "./deals";
import { getMarket, similarTo } from "./listings";
import { countryOfSource, type Country, type Listing } from "./types";

/**
 * Gegevens voor één detailpagina. Bewust gericht: we halen enkel deze wagen op, een compacte set
 * vergelijkbare wagens voor het prijsoordeel, en een handvol wagens voor "vergelijkbare wagens".
 * (De volledige markt inladen kostte ±10 MB per paginaweergave.)
 */
export interface CarPage {
  car: Listing;
  deal: Deal | null;
  similar: Listing[];
  now: number;
}

const SOURCES: Record<Country, string[]> = {
  BE: ["volvo_be", "volvo_selekt"],
  NL: ["volvo_nl", "volvo_selekt_nl"],
};

/** Enkel de velden die het prijsoordeel nodig heeft: ±100 bytes per wagen i.p.v. ±2 kB */
const PEER_SELECT = [
  "id",
  "source",
  "model",
  "price",
  "fuel:data->>fuel",
  "condition:data->>condition",
  "trim:data->>trim",
  "powertrain:data->>powertrain",
  "mileageKm:data->mileageKm",
  "powerHp:data->powerHp",
  "modelYear:data->modelYear",
  "firstRegistration:data->>firstRegistration",
  "reserved:data->reserved",
].join(",");

/** Aantal kandidaten voor "vergelijkbare wagens" (daaruit kiezen we er vier) */
const SIMILAR_CANDIDATES = 40;

export async function getCarPage(id: string): Promise<CarPage | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const now = Date.now();

  // Lokaal (zonder Supabase) lezen we de snapshotbestanden; die staan toch al in het geheugen
  if (!url || !key) {
    const market = await getMarket();
    const car = market.byId.get(id);
    if (!car) return null;
    return { car, deal: market.deals.get(car.id) ?? null, similar: similarTo(car, market.snapshot.listings), now };
  }

  const headers = { apikey: key, authorization: `Bearer ${key}` };
  const get = async <T>(query: string, revalidate: number): Promise<T[]> => {
    const res = await fetch(`${url}/rest/v1/listings?${query}`, {
      headers,
      next: { revalidate, tags: ["listings"] },
    });
    if (!res.ok) throw new Error(`Supabase: ${res.status} ${await res.text()}`);
    return res.json();
  };

  const [row] = await get<{ data: Listing }>(`select=data&active=eq.true&id=eq.${encodeURIComponent(id)}`, 300);
  if (!row) return null;
  const car = row.data;
  const country = car.country ?? countryOfSource(car.source);
  const sources = `source=in.(${(SOURCES[country] ?? SOURCES.BE).join(",")})`;
  const model = `model=eq.${encodeURIComponent(car.model)}`;

  // Mislukt het prijsoordeel of de lijst met gelijkaardige wagens, dan tonen we de wagen gewoon zonder
  const soft = async <T>(query: string, revalidate: number): Promise<T[]> => {
    try {
      return await get<T>(query, revalidate);
    } catch (e) {
      console.error("Detailpagina: extra gegevens ophalen mislukt", e);
      return [];
    }
  };

  // Vergelijkbare wagens: kandidaten rond dezelfde prijs, de beste vier kiezen we zelf
  const [peers, candidates] = await Promise.all([
    soft<Peer>(`select=${PEER_SELECT}&active=eq.true&${model}&${sources}`, 3600),
    soft<{ data: Listing }>(
      `select=data&active=eq.true&${model}&${sources}&data->>condition=eq.${car.condition}` +
        `&price=gte.${Math.round(car.price * 0.75)}&price=lte.${Math.round(car.price * 1.25)}` +
        `&id=neq.${encodeURIComponent(id)}&limit=${SIMILAR_CANDIDATES}`,
      3600,
    ),
  ]);

  return {
    car,
    deal: peers.length ? dealFor(car, peers, now) : null,
    similar: similarTo(car, candidates.map((c) => c.data)),
    now,
  };
}
