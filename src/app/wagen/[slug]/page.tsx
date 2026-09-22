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

  return (
    <SiteShell>
      <nav className="pb-4 pt-2 text-sm text-muted" aria-label="Kruimelpad">
        <Link href={country === "NL" ? "/?land=nl" : "/"} className="hover:text-ink">
          Alle wagens
        </Link>
        {" / "}
        <Link href={`/modellen/${modelSlug(car.model)}`} className="hover:text-ink">
          {car.model}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <Gallery images={car.images} alt={`${car.model} in ${car.color ?? ""}`} studio={!used} />

        <aside className="grid content-start gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={car.source} />
              {car.reserved && (
                <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-black">GERESERVEERD</span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-medium tracking-tight">
              {car.model} {car.trim}
            </h1>
            <p className="text-muted">
              {[used ? (regYear ?? car.modelYear) : car.modelYear, used && car.mileageKm != null && `${car.mileageKm.toLocaleString("nl-BE")} km`, car.powertrain]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatEuro(car.price)}</p>
              {saving > 0 && (
                <p className="mt-1 text-sm text-muted">
                  <span className="line-through">{formatEuro(car.listPrice!)}</span>{" "}
                  <span className="font-semibold text-save">Bespaar {formatEuro(saving)}</span>
                </p>
              )}
            </div>
            <FavoriteButton card={toCard(car, deal)} />
          </div>

          {deal && <DealBox deal={deal} car={car} />}

          <a
            href={car.url}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-bg transition hover:opacity-85"
          >
            Bekijk bij {car.dealer?.name ?? "de verdeler"} op {SOURCE_NAME[car.source] ?? "de site van de verkoper"}
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-surface p-5 text-sm">
            {specs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
          </dl>
        </aside>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-5">
          <h2 className="text-lg font-medium">Prijsverloop</h2>
          <p className="mb-3 text-sm text-muted">
            {atDealerSince != null && atDealerSince > 0 && `Bij de verdeler sinds ${atDealerSince} dagen · `}
            Door ons gevolgd sinds {followedSince <= 0 ? "vandaag" : `${followedSince} ${followedSince === 1 ? "dag" : "dagen"}`}
          </p>
          <PriceChart history={history} now={now} />
        </section>

        <section className="rounded-2xl bg-surface p-5">
          <h2 className="mb-3 text-lg font-medium">Verkoper</h2>
          <p className="font-medium">{car.dealer?.name}</p>
          <p className="text-sm text-muted">
            {[car.dealer?.street, [car.dealer?.zip, car.dealer?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
            {car.dealer?.province && ` · ${car.dealer.province}`}
          </p>
          {car.dealer?.lat != null && car.dealer?.lon != null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${car.dealer.lat},${car.dealer.lon}`}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              Toon op kaart
            </a>
          )}
          {(car.options.length > 0 || car.packs.length > 0) && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold">Pakketten en opties</h3>
              <ul className="flex flex-wrap gap-1.5">
                {[...car.packs, ...car.options].slice(0, 30).map((o) => (
                  <li key={o} className="rounded-md bg-surface-2 px-2.5 py-1 text-xs">
                    {o}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-medium">Vergelijkbare {car.model}&apos;s</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <ListingCard key={s.id} card={toCard(s, market.deals.get(s.id))} isNew={false} distance={null} />
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  );
}

function DealBox({ deal, car }: { deal: Deal; car: Listing }) {
  const tone =
    deal.label === "scherp" || deal.label === "goed"
      ? "border-save/30 bg-save-bg text-save"
      : deal.label === "hoog"
        ? "border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "border-line bg-surface text-ink";
  const pct = Math.abs(Math.round(deal.diff));
  const text =
    deal.kind === "used"
      ? `Wij verwachten ongeveer ${formatEuro(deal.reference)} voor een ${car.model} van deze leeftijd, kilometerstand en dit vermogen. Deze wagen is ${pct}% ${deal.diff < 0 ? "goedkoper" : "duurder"}.`
      : `De typische prijs voor een ${car.model} ${car.powertrain ?? ""} ${car.trim?.split(" ")[0] ?? ""} op stock is ${formatEuro(deal.reference)}. Deze wagen is ${pct}% ${deal.diff < 0 ? "goedkoper" : "duurder"}.`;
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="font-semibold">{DEAL_TEXT[deal.label]}</p>
      <p className="mt-1 text-sm opacity-90">{text}</p>
      <p className="mt-2 text-xs opacity-70">Vergeleken met {deal.peers} vergelijkbare wagens. Een indicatie, geen garantie.</p>
    </div>
  );
}
