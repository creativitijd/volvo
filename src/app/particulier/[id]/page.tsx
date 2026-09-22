import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrivateAd } from "@/lib/data";
import { toCard } from "@/lib/card";
import { DRIVE_LABEL, formatEuro } from "@/lib/format";
import { SiteShell } from "@/components/SiteShell";
import { Gallery } from "@/components/Gallery";
import { PhoneReveal } from "@/components/PhoneReveal";
import { FavoriteButton } from "@/components/FavoriteButton";

export async function generateMetadata(props: PageProps<"/particulier/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const ad = await getPrivateAd(id);
  if (!ad) return { title: "Advertentie niet gevonden | Vind een Volvo" };
  return {
    title: `${ad.model} ${ad.modelYear} · ${formatEuro(ad.price)} | Vind een Volvo`,
    description: `Tweedehands ${ad.model} van ${ad.sellerType === "business" ? ad.dealer?.name : "een particulier"} in ${ad.dealer?.city}: ${ad.mileageKm?.toLocaleString("nl-BE")} km, ${ad.fuel}.`,
    openGraph: ad.images[0] ? { images: [ad.images[0]] } : undefined,
  };
}

export default async function PrivateAdPage(props: PageProps<"/particulier/[id]">) {
  const { id } = await props.params;
  const ad = await getPrivateAd(id);
  if (!ad) notFound();

  const business = ad.sellerType === "business";
  const specs: [string, string | null][] = [
    ["Eerste inschrijving", String(ad.modelYear)],
    ["Kilometerstand", ad.mileageKm != null ? `${ad.mileageKm.toLocaleString("nl-BE")} km` : null],
    ["Brandstof", ad.fuel],
    ["Motor", [ad.powertrain, ad.powerHp && `${ad.powerHp} pk`].filter(Boolean).join(" · ") || null],
    ["Uitvoering", ad.trim],
    ["Versnellingsbak", ad.transmission],
    ["Aandrijving", ad.drive ? (DRIVE_LABEL[ad.drive] ?? ad.drive) : null],
    ["Kleur", ad.color],
    ["Locatie", [ad.dealer?.zip, ad.dealer?.city].filter(Boolean).join(" ")],
    ...(business ? ([["Verkoper", ad.dealer?.name ?? null], ["Btw-nummer", ad.dealer?.group ?? null]] as [string, string | null][]) : []),
  ];

  return (
    <SiteShell>
      <Link href="/?staat=tweedehands" className="inline-block pb-4 pt-2 text-sm text-muted hover:text-ink">
        ← Alle tweedehands Volvo&apos;s
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <Gallery images={ad.images} alt={`${ad.model} ${ad.color ?? ""}`} />

        <aside className="grid content-start gap-5">
          <div>
            <span className="inline-block rounded-md bg-surface-2 px-2.5 py-1 text-xs font-semibold">
              {business ? `Verkocht door ${ad.dealer?.name}` : "Particuliere verkoper"}
            </span>
            <h1 className="mt-3 text-3xl font-medium tracking-tight">
              {ad.model} {ad.trim}
            </h1>
            <p className="text-muted">
              {ad.modelYear} · {ad.mileageKm?.toLocaleString("nl-BE")} km · {ad.dealer?.city}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatEuro(ad.price)}</p>
            <FavoriteButton card={toCard(ad)} />
          </div>
          {ad.phone && <PhoneReveal phone={ad.phone} />}
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-surface p-5 text-sm">
            {specs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <div className="rounded-2xl border border-line p-4 text-xs leading-relaxed text-muted">
            <p className="mb-1 font-semibold text-ink">Veilig kopen{business ? "" : " van een particulier"}</p>
            Bekijk de wagen altijd ter plaatse, vraag het Car-Pass en keuringsbewijs, en betaal nooit vooraf.
            {business && " Koop je als consument van een bedrijf, dan heb je recht op de wettelijke garantie."} Vind een
            Volvo kijkt advertenties na, maar is geen partij bij de verkoop.
          </div>
        </aside>
      </div>

      {ad.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 text-xl font-medium">Beschrijving van de verkoper</h2>
          <p className="whitespace-pre-line leading-relaxed">{ad.description}</p>
        </section>
      )}
    </SiteShell>
  );
}
