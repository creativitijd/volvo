const euro = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatEuro = (n: number) => euro.format(n);

export function timeAgo(ms: number, now = Date.now()): string {
  const min = Math.round((now - ms) / 60000);
  if (min < 1) return "zonet";
  if (min < 60) return `${min} min geleden`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.round(h / 24);
  return d === 1 ? "gisteren" : `${d} dagen geleden`;
}

/** Belgische postcode → provincie (postcodes zijn per provincie ingedeeld). */
export function province(zip: string | null): string | null {
  const z = Number(zip);
  if (!z) return null;
  if (z < 1300) return "Brussel";
  if (z < 1500) return "Waals-Brabant";
  if (z < 2000) return "Vlaams-Brabant";
  if (z < 3000) return "Antwerpen";
  if (z < 3500) return "Vlaams-Brabant";
  if (z < 4000) return "Limburg";
  if (z < 5000) return "Luik";
  if (z < 6000) return "Namen";
  if (z < 6600) return "Henegouwen";
  if (z < 7000) return "Luxemburg";
  if (z < 8000) return "Henegouwen";
  if (z < 9000) return "West-Vlaanderen";
  return "Oost-Vlaanderen";
}

export const PROVINCES = [
  "Antwerpen",
  "Oost-Vlaanderen",
  "West-Vlaanderen",
  "Vlaams-Brabant",
  "Limburg",
  "Brussel",
  "Waals-Brabant",
  "Henegouwen",
  "Luik",
  "Luxemburg",
  "Namen",
];

export const NL_PROVINCES = [
  "Noord-Holland",
  "Zuid-Holland",
  "Utrecht",
  "Noord-Brabant",
  "Gelderland",
  "Overijssel",
  "Limburg",
  "Flevoland",
  "Fryslân",
  "Groningen",
  "Drenthe",
  "Zeeland",
];

/** Afstand in km (haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kleurfamilies voor de kleurfilter: tientallen Volvo-lakken → een handvol herkenbare kleuren. */
export const COLOR_FAMILIES: { name: string; hex: string; match: RegExp }[] = [
  { name: "Zwart", hex: "#18191b", match: /black|zwart|noir|onyx|stone|schwarz|midnight|void/i },
  { name: "Grijs", hex: "#6f7378", match: /grey|gray|grijs|grau|gris|platinum|thunder|osmium|pebble|savile|vapou?r|graphite|magnesium|space/i },
  { name: "Zilver", hex: "#c3c6c9", match: /silver|zilver|argent|dawn|aurora|glacier|moon/i },
  { name: "Wit", hex: "#f3f2ee", match: /white|wit|blanc|weiss|pearl|snow|seashell/i },
  { name: "Blauw", hex: "#3f5c88", match: /blue|blauw|bleu|denim|fjord/i },
  { name: "Groen", hex: "#3e5a4b", match: /green|groen|vert|forest|sage|lake/i },
  { name: "Rood", hex: "#8c1d25", match: /red|rood|rouge|mulberry|fusion|ruby/i },
  { name: "Beige", hex: "#b9a98b", match: /sand|dune|birch|dusk|beige|bronze|copper|brown|bruin|champagne|gold/i },
  { name: "Geel", hex: "#c7ad48", match: /yellow|geel|jaune/i },
];

/** Volgorde telt: "Moss Yellow" is geel, "Forest Lake" groen, "Pine Grey" grijs */
const FAMILY_ORDER = ["Geel", "Rood", "Groen", "Blauw", "Wit", "Zilver", "Grijs", "Zwart", "Beige"];

export function colorFamily(color: string | null): string {
  if (!color) return "Overig";
  for (const name of FAMILY_ORDER) {
    if (COLOR_FAMILIES.find((f) => f.name === name)!.match.test(color)) return name;
  }
  return "Overig";
}

/** Benaderende lakkleuren voor de kleurstaaltjes. */
export const COLOR_HEX: Record<string, string> = {
  "Onyx Black": "#18191b",
  "Vapour Grey": "#8d9195",
  "Forest Lake": "#3a4943",
  "Denim Blue": "#48586d",
  "Aurora Silver": "#bcc0c3",
  "Crystal White Pearl": "#f1f0ec",
  "Sand Dune": "#b9a98b",
  "Mulberry Red": "#6a2231",
  "Bright Dusk": "#cbbba6",
  "Platinum Grey": "#6e7174",
  "Cloud Blue": "#a8b6c3",
  "Moss Yellow": "#b5a453",
  "Silver Dawn": "#c9c7c1",
  "Thunder Grey": "#5f6468",
  "Crystal White": "#f3f3f0",
  "Fusion Red": "#8c1d25",
  "Pine Grey": "#56605d",
  "Pebble Grey": "#9a9892",
  "Sage Green": "#7d8a78",
  "Ice White": "#f4f5f3",
  "Birch Light": "#d8d2c4",
  "Bursting Blue": "#2f5f9e",
  "Osmium Grey": "#4b4e52",
  "Black Stone": "#1d1d1d",
  "Glacier Silver": "#c3c6c8",
  "Savile Grey": "#7b7f82",
  "Pebble Grey Metallic": "#9a9892",
};

export const DRIVE_LABEL: Record<string, string> = {
  FWD: "Voorwielaandrijving",
  RWD: "Achterwielaandrijving",
  AWD: "Vierwielaandrijving",
};
