// Particuliere advertenties: wat de verkoper invult, en de omzetting naar het gedeelde Listing-model.
// Imports met .ts-extensie, zodat ook de Node-scripts dit bestand kunnen gebruiken.

import type { Listing } from "./types";
import { province as beProvince } from "./format.ts";

export const PRIVATE_MODELS = [
  "C30", "C40", "C70", "EC40", "ES90", "EX30", "EX40", "EX60", "EX90",
  "S40", "S60", "S80", "S90", "V40", "V40 Cross Country", "V50", "V60", "V60 Cross Country",
  "V70", "V90", "V90 Cross Country", "XC40", "XC60", "XC70", "XC90",
];

export const PRIVATE_FUELS = ["Benzine", "Diesel", "Elektrisch", "Plug-in hybride"] as const;
export const PRIVATE_TRIMS = [
  "Core", "Plus", "Ultra", "Ultimate", "Essential", "Momentum", "Inscription", "R-Design", "Kinetic", "Summum", "Base", "Anders",
];

/** Wat de verkoper invult (opgeslagen in private_listings.data) */
export interface PrivateAd {
  /** Ontbreekt bij oudere advertenties = particulier */
  sellerType?: "private" | "business";
  companyName?: string | null;
  vatNumber?: string | null;
  model: string;
  regYear: number;
  fuel: string;
  powertrain: string | null; // "B4", "T6 AWD", "D4", ...
  powerHp: number | null;
  trim: string | null;
  transmission: "Automaat" | "Manueel";
  drive: "FWD" | "RWD" | "AWD" | null;
  color: string;
  mileageKm: number;
  price: number;
  /** Ontbreekt bij oudere advertenties = België */
  country?: "BE" | "NL";
  zip: string;
  city: string;
  province?: string | null;
  lat: number | null;
  lon: number | null;
  description: string;
}

/** BTW-nummer: België BE0123456789 / BE1..., Nederland NL123456789B01 (spaties en punten mogen) */
export function normalizeVat(v: string): string | null {
  const s = v.toUpperCase().replace(/[\s.-]/g, "");
  if (/^BE[01]\d{9}$/.test(s)) return s;
  if (/^NL\d{9}B\d{2}$/.test(s)) return s;
  return null;
}

export interface PrivateListingRow {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected" | "sold";
  data: PrivateAd;
  photos: string[];
  phone: string;
  reject_reason: string | null;
  created_at: string;
  approved_at: string | null;
  expires_at: string | null;
}

export function privateToListing(row: PrivateListingRow, siteUrl = ""): Listing {
  const d = row.data;
  const since = Date.parse(row.approved_at ?? row.created_at);
  return {
    id: `particulier:${row.id}`,
    source: "particulier",
    sourceId: row.id,
    country: d.country ?? "BE",
    url: `${siteUrl}/particulier/${row.id}`,
    condition: "used",
    vin: null,
    model: d.model,
    title: [d.model, d.trim, d.powertrain].filter(Boolean).join(" "),
    modelYear: d.regYear,
    fuel: d.fuel,
    powertrain: d.powertrain,
    drive: d.drive,
    powerHp: d.powerHp,
    trim: d.trim && d.trim !== "Anders" ? d.trim : null,
    body: null,
    color: d.color,
    interior: null,
    transmission: d.transmission,
    mileageKm: d.mileageKm,
    firstRegistration: `${d.regYear}-01-01`,
    listPrice: null,
    price: d.price,
    options: [],
    packs: [],
    description: d.description,
    sellerType: d.sellerType ?? "private",
    phone: row.phone,
    images: row.photos,
    dealer: {
      name: d.sellerType === "business" && d.companyName ? d.companyName : "Particulier",
      group: d.sellerType === "business" ? (d.vatNumber ?? null) : null,
      street: null,
      zip: d.zip,
      city: d.city,
      phone: null,
      lat: d.lat,
      lon: d.lon,
      province: d.province ?? ((d.country ?? "BE") === "BE" ? beProvince(d.zip) : null),
    },
    listedAt: since,
    firstSeen: since,
    lastSeen: Date.now(),
    previousPrice: null,
  };
}
