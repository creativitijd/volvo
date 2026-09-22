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
      <Link href="/?staat=tweedehands" className="mb-5 inline-block text-[13.5px] text-muted hover:text-ink">
        Alle tweedehands Volvo&apos;s
      </Link>
      <div className="grid items-start gap-8 lg:grid-cols-[1.45fr_1fr]">
        <Gallery images={ad.images} alt={`${ad.model} ${ad.color ?? ""}`} />

        <aside className="grid content-start gap-5">
          <div>
            <span className="inline-flex rounded bg-[#1a4b8c] px-1.5 py-1 text-[10.5px] font-semibold text-white">
              {business ? ad.dealer?.name : "Particulier"}
            </span>
            <h1 className="font-serif mt-4 text-[34px] leading-tight font-light tracking-tight">
              {ad.model} {ad.trim}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {[ad.color, ad.dealer?.city].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="font-serif text-[40px] leading-none font-normal">{formatEuro(ad.price)}</p>
            <FavoriteButton card={toCard(ad)} />
          </div>
          <PhoneReveal adId={ad.sourceId} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-3xl bg-[#f6f6f6] p-5 sm:grid-cols-3">
            {specs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] tracking-[0.07em] text-[#a8a8a8] uppercase">{k}</dt>
                  <dd className="mt-1 text-sm break-words">{v}</dd>
                </div>
              ))}
          </dl>
          <div className="rounded-3xl bg-[#f6f6f6] p-5 text-[13px] leading-relaxed text-[#4a4a4a]">
            <p className="mb-1 font-medium text-ink">Veilig kopen{business ? "" : " van een particulier"}</p>
            Bekijk de wagen altijd ter plaatse, vraag het Car-Pass en keuringsbewijs, en betaal nooit vooraf.
            {business && " Koop je als consument van een bedrijf, dan heb je recht op de wettelijke garantie."} Vind een
            Volvo kijkt advertenties na, maar is geen partij bij de verkoop.
          </div>
        </aside>
      </div>

      {ad.description && (
        <section className="mt-8 max-w-3xl rounded-3xl bg-[#f6f6f6] p-6 sm:p-8">
          <h2 className="font-serif mb-3 text-[26px] font-light tracking-tight">Beschrijving van de verkoper</h2>
          <p className="whitespace-pre-line leading-relaxed">{ad.description}</p>
        </section>
      )}
    </SiteShell>
  );
}
