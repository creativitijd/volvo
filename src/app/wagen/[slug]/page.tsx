import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMarket, idFromSlug, similarTo } from "@/lib/listings";
import { pagePath, toCard } from "@/lib/card";
import { DEAL_TEXT, type Deal } from "@/lib/deals";
import { DRIVE_LABEL, formatEuro } from "@/lib/format";
import { countryOfSource, type Listing } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";
import { modelSlug } from "@/lib/stats";
import { Gallery } from "@/components/Gallery";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ListingCard } from "@/components/ListingCard";
import { PriceChart } from "@/components/PriceChart";
import { SourceBadge } from "@/components/SourceBadge";

// Detailpagina's worden bij het eerste bezoek gebouwd en daarna een uur gecachet
export const revalidate = 3600;

const DAY = 86_400_000;

const SOURCE_NAME: Record<string, string> = {
  volvo_be: "volvostock.be",
  volvo_selekt: "Volvo Selekt",
  volvo_selekt_nl: "Volvo Selekt",
  volvo_nl: "volvocars.com",
};

async function load(slug: string) {
  const id = idFromSlug(slug);
  if (!id) return null;
  const market = await getMarket();
  const car = market.byId.get(id);
  return car ? { car, market } : null;
}

export async function generateMetadata(props: PageProps<"/wagen/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const found = await load(slug);
  if (!found) return { title: "Wagen niet (meer) beschikbaar | Vind een Volvo" };
  const { car } = found;
  const what = car.condition === "new" ? "nieuwe stockwagen" : `tweedehands, ${car.mileageKm?.toLocaleString("nl-BE")} km`;
  return {
    title: `${car.model} ${car.trim ?? ""} · ${formatEuro(car.price)} | Vind een Volvo`,
    description: `Volvo ${car.model} ${car.trim ?? ""} (${what}) bij ${car.dealer?.name} in ${car.dealer?.city}. Prijsverloop en vergelijking met de markt.`,
    openGraph: car.images[0] ? { images: [car.images[0]] } : undefined,
  };
}

export default async function CarPage(props: PageProps<"/wagen/[slug]">) {
  const { slug } = await props.params;
  const found = await load(slug);
  if (!found) notFound();
  const { car, market } = found;
  if (car.source === "particulier") redirect(pagePath(car));

  const deal = market.deals.get(car.id) ?? null;
  const country = car.country ?? countryOfSource(car.source);
  const used = car.condition === "used";
  const now = market.key; // tijdstip van de laatste sync (stabiel binnen de cache)
  const saving = car.listPrice && car.listPrice > car.price ? car.listPrice - car.price : 0;
  const history = car.priceHistory ?? [[car.firstSeen, car.price]];
  const similar = similarTo(car, market.snapshot.listings);
  const regYear = car.firstRegistration ? new Date(car.firstRegistration).getFullYear() : null;
  const atDealerSince = car.listedAt ? Math.round((now - car.listedAt) / DAY) : null;
  const followedSince = Math.round((now - car.firstSeen) / DAY);

  const specs: [string, string | null | undefined][] = [
    [used ? "Eerste inschrijving" : "Modeljaar", String(used ? (regYear ?? car.modelYear) : car.modelYear)],
    ["Kilometerstand", car.mileageKm != null ? `${car.mileageKm.toLocaleString("nl-BE")} km` : null],
    ["Brandstof", car.fuel],
    ["Motor", [car.powertrain, car.powerHp && `${car.powerHp} pk`].filter(Boolean).join(" · ") || null],
    ["Uitvoering", car.trim],
    ["Aandrijving", car.drive ? (DRIVE_LABEL[car.drive] ?? car.drive) : null],
    ["Versnellingsbak", car.transmission],
    ["Carrosserie", car.body],
    ["Kleur", car.color],
    ["Interieur", car.interior],
    ["VIN", car.vin],
  ];

  const subtitle = [car.color, car.interior].filter(Boolean).join(" · ");

  return (
    <SiteShell>
      <nav className="mb-5 text-[13.5px] text-muted" aria-label="Kruimelpad">
        <Link href={country === "NL" ? "/?land=nl" : "/"} className="hover:text-ink">
          Alle wagens
        </Link>
        <span className="mx-2 text-[#c4c4c4]">/</span>
        <Link href={`/modellen/${modelSlug(car.model)}`} className="hover:text-ink">
          {car.model}
        </Link>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[1.45fr_1fr]">
        <Gallery
          images={car.images}
          alt={`${car.model} in ${car.color ?? ""}`}
          studio={!used}
          badge={
            <div className="flex flex-wrap gap-1.5">
              <SourceBadge source={car.source} />
              {car.reserved && (
                <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-black">GERESERVEERD</span>
              )}
            </div>
          }
        />

        <aside className="grid content-start gap-5">
          <div>
            <h1 className="font-serif text-[34px] leading-tight font-light tracking-tight">
              {car.model} {car.trim}
            </h1>
            {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <p className="font-serif text-[40px] leading-none font-normal">{formatEuro(car.price)}</p>
              {saving > 0 && <span className="text-[13px] text-[#9a9a9a] line-through">{formatEuro(car.listPrice!)}</span>}
            </div>
            {saving > 0 && (
              <span className="rounded-[5px] bg-save-bg px-2.5 py-1 text-xs font-semibold text-save">−{formatEuro(saving)}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton card={toCard(car, deal)} />
          </div>

          {deal && <DealBox deal={deal} car={car} />}

          <a
            href={car.url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-mark px-6 py-3.5 text-center text-[14.5px] font-medium text-ink transition hover:bg-[#e8c52e]"
          >
            Bekijk bij {car.dealer?.name ?? "de verdeler"}
            <span aria-hidden>↗</span>
          </a>
          <p className="-mt-2 text-[12.5px] text-muted">Opent {SOURCE_NAME[car.source] ?? "de site van de verkoper"}</p>

          <SpecGrid specs={specs} />
        </aside>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl bg-[#f6f6f6] p-6 sm:p-8">
          <h2 className="font-serif text-[26px] font-light tracking-tight">Prijsverloop</h2>
          <p className="mt-2 mb-4 text-[13.5px] text-muted">
            {atDealerSince != null && atDealerSince > 0 && `Bij de verdeler sinds ${atDealerSince} dagen · `}
            Door ons gevolgd sinds {followedSince <= 0 ? "vandaag" : `${followedSince} ${followedSince === 1 ? "dag" : "dagen"}`}
          </p>
          <PriceChart history={history} now={now} />
        </section>

        <section className="rounded-3xl bg-[#f6f6f6] p-6 sm:p-8">
          <h2 className="font-serif text-[26px] font-light tracking-tight">Verkoper</h2>
          <p className="mt-3 font-medium">{car.dealer?.name}</p>
          <p className="text-[13.5px] text-muted">
            {[car.dealer?.street, [car.dealer?.zip, car.dealer?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
            {car.dealer?.province && ` · ${car.dealer.province}`}
          </p>
          {car.dealer?.lat != null && car.dealer?.lon != null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${car.dealer.lat},${car.dealer.lon}`}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-block text-[13.5px] underline underline-offset-4"
            >
              Toon op kaart
            </a>
          )}
          {(car.options.length > 0 || car.packs.length > 0) && (
            <>
              <h3 className="mt-6 mb-2.5 text-sm font-medium">Pakketten en opties</h3>
              <ul className="flex flex-wrap gap-1.5">
                {[...car.packs, ...car.options].slice(0, 30).map((o) => (
                  <li key={o} className="rounded-full bg-white px-3 py-1.5 text-xs">
                    {o}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="font-serif mb-5 text-[28px] font-light tracking-tight">Vergelijkbare {car.model}&apos;s</h2>
          <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]">
            {similar.map((s) => (
              <ListingCard key={s.id} card={toCard(s, market.deals.get(s.id))} isNew={false} distance={null} />
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  );
}

function SpecGrid({ specs }: { specs: [string, string | null | undefined][] }) {
  const rows = specs.filter(([, v]) => v);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-3xl bg-[#f6f6f6] p-5 sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] tracking-[0.07em] text-[#a8a8a8] uppercase">{k}</dt>
          <dd className="mt-1 text-sm break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DealBox({ deal, car }: { deal: Deal; car: Listing }) {
  const tone =
    deal.label === "scherp" || deal.label === "goed"
      ? "bg-save-bg text-save"
      : deal.label === "hoog"
        ? "bg-[#fff6e8] text-[#8a5a00]"
        : "bg-[#f6f6f6] text-ink";
  const pct = Math.abs(Math.round(deal.diff));
  const text =
    deal.kind === "used"
      ? `Wij verwachten ongeveer ${formatEuro(deal.reference)} voor een ${car.model} van deze leeftijd, kilometerstand en dit vermogen. Deze wagen is ${pct}% ${deal.diff < 0 ? "goedkoper" : "duurder"}.`
      : `De typische prijs voor een ${car.model} ${car.powertrain ?? ""} ${car.trim?.split(" ")[0] ?? ""} op stock is ${formatEuro(deal.reference)}. Deze wagen is ${pct}% ${deal.diff < 0 ? "goedkoper" : "duurder"}.`;
  return (
    <div className={`rounded-3xl p-5 ${tone}`}>
      <p className="font-semibold">{DEAL_TEXT[deal.label]}</p>
      <p className="mt-1 text-sm opacity-90">{text}</p>
      <p className="mt-2 text-xs opacity-70">Vergeleken met {deal.peers} vergelijkbare wagens. Een indicatie, geen garantie.</p>
    </div>
  );
}
