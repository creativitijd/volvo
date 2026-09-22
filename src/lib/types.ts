// Gedeeld datamodel voor alle bronnen (fase 1: volvo_be, later: volvo_nl, 2dehands, autoscout24, ...)

export type Source =
  | "volvo_be"
  | "volvo_selekt"
  | "particulier"
  | "volvo_nl"
  | "volvo_selekt_nl"
  | "2dehands"
  | "autoscout24";

export type Country = "BE" | "NL";

/** Land van een bron (voor oudere snapshots zonder `country`-veld) */
export const countryOfSource = (s: Source): Country => (s.endsWith("_nl") ? "NL" : "BE");

export type Condition = "new" | "used";

export interface Dealer {
  name: string;
  group: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lon: number | null;
  /** Provincie; voor België afgeleid uit de postcode, voor Nederland opgezocht via de coördinaten */
  province?: string | null;
}

export interface Listing {
  /** Uniek over alle bronnen heen: `${source}:${sourceId}` */
  id: string;
  source: Source;
  sourceId: string;
  country?: Country;
  url: string;
  condition: Condition;
  /** VIN indien beschikbaar — gebruikt voor ontdubbeling tussen bronnen in fase 2 */
  vin: string | null;

  model: string; // "EX30", "XC60", ...
  title: string;
  modelYear: number | null;
  fuel: string; // "Elektrisch", "Benzine", "Plug-in hybride", ...
  powertrain: string | null; // "P5 Long Range", "B3", "T6 AWD", ...
  drive: string | null; // "FWD" | "RWD" | "AWD"
  powerHp: number | null;
  trim: string | null; // "Core", "Plus", "Ultra", ...
  body: string | null; // "SUV", "Break", ...
  color: string | null;
  interior: string | null;
  transmission: string | null;
  mileageKm: number | null;
  /** Datum eerste inschrijving (ISO), enkel voor tweedehands */
  firstRegistration?: string | null;

  /** Adviesprijs incl. btw */
  listPrice: number | null;
  /** Actuele vraagprijs incl. btw */
  price: number;

  options: string[];
  packs: string[];
  /** Vrije tekst van de verkoper (particuliere advertenties) */
  description?: string | null;
  /** Eigen advertenties: particulier of bedrijf */
  sellerType?: "private" | "business";
  /** Telefoonnummer van de verkoper (eigen advertenties) */
  phone?: string | null;
  images: string[];
  dealer: Dealer | null;

  /** Gereserveerd door een koper (Volvo Selekt): nog zichtbaar bij de bron, maar waarschijnlijk niet meer te koop */
  reserved?: boolean;
  /** Wanneer de bron de wagen online zette (ms) */
  listedAt: number | null;
  /** Wanneer wij de wagen voor het eerst zagen (ms) */
  firstSeen: number;
  /** Wanneer wij de wagen voor het laatst zagen (ms) */
  lastSeen: number;
  /** Vorige prijs als die gewijzigd is sinds de vorige scrape */
  previousPrice: number | null;
  /** Prijshistoriek: [tijdstip (ms), prijs][], enkel punten waar de prijs wijzigde */
  priceHistory?: [number, number][];
}

export interface Snapshot {
  updatedAt: number;
  listings: Listing[];
}
