"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COLOR_HEX } from "@/lib/format";
import { PRIVATE_FUELS, PRIVATE_MODELS, PRIVATE_TRIMS, normalizeVat, type PrivateAd } from "@/lib/private";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/photos";
import { useAccount } from "./AccountProvider";
import { SignedOut } from "./SignedOut";

const MAX_PHOTOS = 10;
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1999 }, (_, i) => THIS_YEAR - i);

type Draft = Omit<PrivateAd, "regYear" | "mileageKm" | "price" | "powerHp" | "lat" | "lon"> & {
  regYear: string;
  mileageKm: string;
  price: string;
  powerHp: string;
  phone: string;
};

const EMPTY: Draft = {
  model: "",
  regYear: "",
  fuel: "",
  powertrain: "",
  powerHp: "",
  trim: "",
  transmission: "Automaat",
  drive: null,
  color: "",
  mileageKm: "",
  price: "",
  zip: "",
  city: "",
  description: "",
  phone: "",
};

export function SellForm() {
  const { user, ready } = useAccount();
  const [d, setD] = useState<Draft>(EMPTY);
  const [country, setCountry] = useState<"BE" | "NL">("BE");
  const [sellerType, setSellerType] = useState<"private" | "business">("private");
  const [company, setCompany] = useState("");
  const [vat, setVat] = useState("");
  const [place, setPlace] = useState<{ lat: number; lon: number; city: string; province: string | null } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    const t = setTimeout(() => setPreviews(urls), 0);
    return () => {
      clearTimeout(t);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  const zipValid = (zip: string, c = country) =>
    c === "NL" ? /^[1-9]\d{3}\s?[A-Za-z]{2}$/.test(zip.trim()) : /^[1-9]\d{3}$/.test(zip);

  async function lookupZip(zip: string, c = country) {
    setPlace(null);
    if (!zipValid(zip, c)) return;
    const res = await fetch(`/api/postcode?pc=${encodeURIComponent(zip)}${c === "NL" ? "&land=nl" : ""}`);
    if (!res.ok) return;
    const p = await res.json();
    setPlace({ lat: p.lat, lon: p.lon, city: String(p.place).replace(/^\d{4}(\s?[A-Z]{2})?\s*/, ""), province: p.province ?? null });
  }

  function validate(): string | null {
    if (!d.model || !d.regYear || !d.fuel) return "Kies model, bouwjaar en brandstof.";
    const km = Number(d.mileageKm);
    const price = Number(d.price);
    if (!Number.isFinite(km) || km < 0 || km > 1_000_000) return "Geef een geldige kilometerstand.";
    if (!Number.isFinite(price) || price < 500 || price > 500_000) return "Geef een geldige prijs (tussen € 500 en € 500.000).";
    if (!d.color.trim()) return "Geef de kleur van de wagen.";
    if (!place) return country === "NL" ? "Geef een geldige Nederlandse postcode (bv. 3511 AB)." : "Geef een geldige Belgische postcode.";
    if (!/^[+\d][\d\s()/.-]{7,19}$/.test(d.phone.trim())) return "Geef een geldig telefoonnummer.";
    if (d.description.trim().length < 20) return "Schrijf een korte beschrijving (minstens 20 tekens).";
    if (!files.length) return "Voeg minstens één foto toe.";
    if (sellerType === "business") {
      if (company.trim().length < 2) return "Geef de naam van je bedrijf.";
      if (!normalizeVat(vat)) return "Geef een geldig btw-nummer (bv. BE0123456789 of NL123456789B01).";
    }
    if (!agree) return "Bevestig dat de wagen van jou (of je bedrijf) is en de gegevens kloppen.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const sb = getSupabase();
    if (!sb || !user || !place) return;
    setError(null);
    setState("saving");
    try {
      const photos: string[] = [];
      for (const [i, f] of files.entries()) {
        setProgress(`Foto ${i + 1} van ${files.length} uploaden…`);
        photos.push(await uploadPhoto(sb, user.id, f));
      }
      setProgress("Advertentie opslaan…");
      const ad: PrivateAd = {
        model: d.model,
        regYear: Number(d.regYear),
        fuel: d.fuel,
        powertrain: d.powertrain?.trim() || null,
        powerHp: Number(d.powerHp) || null,
        trim: d.trim || null,
        transmission: d.transmission,
        drive: d.drive,
        color: d.color.trim(),
        mileageKm: Math.round(Number(d.mileageKm)),
        price: Math.round(Number(d.price)),
        sellerType,
        companyName: sellerType === "business" ? company.trim().slice(0, 80) : null,
        vatNumber: sellerType === "business" ? normalizeVat(vat) : null,
        country,
        zip: d.zip.trim().toUpperCase(),
        city: place.city,
        province: place.province,
        lat: place.lat,
        lon: place.lon,
        description: d.description.trim().slice(0, 2000),
      };
      const { data: created, error } = await sb
        .from("private_listings")
        .insert({ user_id: user.id, data: ad, photos })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      // Het nummer staat apart, zodat het niet publiek opvraagbaar is
      const { error: phoneError } = await sb
        .from("private_listing_phones")
        .insert({ listing_id: created.id, phone: d.phone.trim() });
      if (phoneError) throw new Error(phoneError.message);
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Opslaan lukte niet.");
    } finally {
      setProgress("");
    }
  }

  if (!ready) return null;
  if (!user) return <SignedOut text="Log in om je Volvo te koop te zetten. Een account aanmaken gaat met je e-mailadres, zonder wachtwoord." />;

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center">
        <h2 className="text-2xl font-medium">Bedankt! We bekijken je advertentie</h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Meestal binnen één werkdag. Je krijgt een mail zodra ze online staat. Ze blijft 60 dagen staan en je kan ze
          daarna met één klik verlengen.
        </p>
        <Link href="/mijn-advertenties" className="mt-6 inline-block rounded-md bg-ink px-5 py-2.5 font-medium text-bg">
          Mijn advertenties
        </Link>
      </div>
    );
  }

  const input = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-ink";

  return (
    <form onSubmit={submit} className="grid gap-8" noValidate>
      <Section title="Wie verkoopt?">
        <div className="inline-flex rounded-md bg-surface-2 p-1 text-sm" role="group" aria-label="Soort verkoper">
          {(
            [
              ["private", "Particulier"],
              ["business", "Bedrijf"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setSellerType(v)}
              aria-pressed={sellerType === v}
              className={`rounded-md px-4 py-1.5 transition ${sellerType === v ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {sellerType === "business" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Bedrijfsnaam" hint="Wordt getoond op je advertentie">
              <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} autoComplete="organization" />
            </Field>
            <Field label="Btw-nummer" hint="bv. BE0123456789 of NL123456789B01">
              <input className={input} value={vat} onChange={(e) => setVat(e.target.value.toUpperCase())} maxLength={20} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="De wagen">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Model">
            <select className={input} value={d.model} onChange={(e) => set("model", e.target.value)} required>
              <option value="">Kies…</option>
              {PRIVATE_MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Eerste inschrijving">
            <select className={input} value={d.regYear} onChange={(e) => set("regYear", e.target.value)} required>
              <option value="">Jaar…</option>
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Brandstof">
            <select className={input} value={d.fuel} onChange={(e) => set("fuel", e.target.value)} required>
              <option value="">Kies…</option>
              {PRIVATE_FUELS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Motor" hint="bv. B4, T6 AWD, D4 (optioneel)">
            <input className={input} value={d.powertrain ?? ""} onChange={(e) => set("powertrain", e.target.value)} maxLength={40} />
          </Field>
          <Field label="Vermogen (pk)" hint="optioneel">
            <input className={input} inputMode="numeric" value={d.powerHp} onChange={(e) => set("powerHp", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Uitvoering" hint="optioneel">
            <select className={input} value={d.trim ?? ""} onChange={(e) => set("trim", e.target.value)}>
              <option value="">Weet ik niet</option>
              {PRIVATE_TRIMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Versnellingsbak">
            <select className={input} value={d.transmission} onChange={(e) => set("transmission", e.target.value as Draft["transmission"])}>
              <option>Automaat</option>
              <option>Manueel</option>
            </select>
          </Field>
          <Field label="Aandrijving" hint="optioneel">
            <select className={input} value={d.drive ?? ""} onChange={(e) => set("drive", (e.target.value || null) as Draft["drive"])}>
              <option value="">Weet ik niet</option>
              <option value="FWD">Voorwielaandrijving</option>
              <option value="RWD">Achterwielaandrijving</option>
              <option value="AWD">Vierwielaandrijving (AWD)</option>
            </select>
          </Field>
          <Field label="Kleur">
            <input className={input} list="volvo-colors" value={d.color} onChange={(e) => set("color", e.target.value)} maxLength={40} placeholder="bv. Onyx Black" />
            <datalist id="volvo-colors">
              {Object.keys(COLOR_HEX).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
      </Section>

      <Section title="Prijs en kilometerstand">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kilometerstand">
            <input className={input} inputMode="numeric" value={d.mileageKm} onChange={(e) => set("mileageKm", e.target.value.replace(/\D/g, ""))} placeholder="bv. 85000" />
          </Field>
          <Field label="Vraagprijs (€)">
            <input className={input} inputMode="numeric" value={d.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} placeholder="bv. 24500" />
          </Field>
        </div>
      </Section>

      <Section title="Foto's" hint={`Minstens 1, maximaal ${MAX_PHOTOS}. De eerste foto is de hoofdfoto.`}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-bg">HOOFDFOTO</span>}
              <button
                type="button"
                onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                aria-label="Foto verwijderen"
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-surface/90 text-sm shadow"
              >
                ✕
              </button>
            </div>
          ))}
          {files.length < MAX_PHOTOS && (
            <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-sm text-muted hover:border-muted">
              <span className="text-center">+ Foto&apos;s</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
                  setFiles((fs) => [...fs, ...picked].slice(0, MAX_PHOTOS));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </Section>

      <Section title="Beschrijving">
        <textarea
          className={`${input} min-h-36`}
          value={d.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={2000}
          placeholder="Onderhoud, opties, schade, reden van verkoop, keuring/Car-Pass…"
        />
        <p className="mt-1 text-right text-xs text-muted">{d.description.length}/2000</p>
      </Section>

      <Section title="Waar en hoe contacteren">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Land">
            <select
              className={input}
              value={country}
              onChange={(e) => {
                const c = e.target.value as "BE" | "NL";
                setCountry(c);
                set("zip", "");
                setPlace(null);
              }}
            >
              <option value="BE">België</option>
              <option value="NL">Nederland</option>
            </select>
          </Field>
          <Field label="Postcode" hint={place ? place.city : "Enkel je gemeente wordt getoond"}>
            <input
              className={input}
              inputMode={country === "NL" ? "text" : "numeric"}
              maxLength={country === "NL" ? 7 : 4}
              placeholder={country === "NL" ? "bv. 3511 AB" : "bv. 2000"}
              value={d.zip}
              onChange={(e) => {
                const zip = country === "NL" ? e.target.value.toUpperCase().replace(/[^0-9A-Z ]/g, "") : e.target.value.replace(/\D/g, "");
                set("zip", zip);
                if (zipValid(zip)) lookupZip(zip);
                else setPlace(null);
              }}
            />
          </Field>
          <Field label="Telefoonnummer" hint="Wordt getoond op je advertentie">
            <input className={input} type="tel" autoComplete="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="bv. 0470 12 34 56" />
          </Field>
        </div>
      </Section>

      <div className="grid gap-4 rounded-2xl bg-surface p-5">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ink)]" />
          <span>
            {sellerType === "business" ? (
              <>
                Ik verkoop namens <strong>{company.trim() || "mijn bedrijf"}</strong>, de wagen is eigendom van het bedrijf
                en de gegevens kloppen. De bedrijfsnaam, het telefoonnummer en de gemeente worden op de advertentie getoond.
              </>
            ) : (
              <>
                Ik verkoop als <strong>particulier</strong>, de wagen is van mij en de gegevens kloppen. Ik ga ermee akkoord
                dat mijn telefoonnummer en gemeente op de advertentie getoond worden.
              </>
            )}{" "}
            De advertentie staat 60 dagen online na goedkeuring.
          </span>
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={state === "saving"}
          className="justify-self-start rounded-md bg-ink px-6 py-3 font-medium text-bg disabled:opacity-50"
        >
          {state === "saving" ? progress || "Bezig…" : "Advertentie insturen"}
        </button>
        <p className="text-xs text-muted">We kijken elke advertentie na voor ze online komt. Enkel Volvo&apos;s.</p>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
