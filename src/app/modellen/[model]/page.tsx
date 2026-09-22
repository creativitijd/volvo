import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarket } from "@/lib/listings";
import { toCard } from "@/lib/card";
import { COLOR_FAMILIES, formatEuro } from "@/lib/format";
import { allModels, modelSlug, modelStats, type ModelStats, type SegmentStats } from "@/lib/stats";
import type { Country } from "@/lib/types";
import type { Deal } from "@/lib/deals";
import { SiteShell } from "@/components/SiteShell";
import { DEFAULT_CONTENT, MODEL_CONTENT } from "@/content/models";
import { ListingCard } from "@/components/ListingCard";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { snapshot } = await getMarket();
  return allModels(snapshot.listings).map((m) => ({ model: modelSlug(m.model) }));
}

async function load(slug: string) {
  const market = await getMarket();
  const entry = allModels(market.snapshot.listings).find((m) => modelSlug(m.model) === slug);
  if (!entry) return null;
  const stats = (["BE", "NL"] as Country[])
    .map((c) => modelStats(market.snapshot.listings, market.deals, entry.model, c, market.key))
    .filter((s) => s.total > 0);
  return { entry, stats, deals: market.deals };
}

export async function generateMetadata(props: PageProps<"/modellen/[model]">): Promise<Metadata> {
  const { model } = await props.params;
  const found = await load(model);
  if (!found) return { title: "Model niet gevonden | Vind een Volvo" };
  const { entry } = found;
  return {
    title: `Volvo ${entry.model} te koop: stock, occasions en prijzen | Vind een Volvo`,
    description: `${entry.count} Volvo ${entry.model}'s te koop in België en Nederland, vanaf ${formatEuro(entry.minPrice)}. Nieuwe stockwagens, Volvo Selekt en particulieren, met prijsvergelijking.`,
  };
}

export default async function ModelPage(props: PageProps<"/modellen/[model]">) {
  const { model } = await props.params;
  const found = await load(model);
  if (!found) notFound();
  const { entry, stats, deals } = found;
  const content = MODEL_CONTENT[entry.model] ?? DEFAULT_CONTENT;
  const fuels = [...new Set(stats.flatMap((s) => s.fuels.map(([f]) => f)))];
  const hp = stats.flatMap((s) => s.engines.flatMap((e) => [e.hpMin, e.hpMax])).filter((h): h is number => h != null);
  const totalDeals = stats.reduce((n, s) => n + s.fresh.goodDeals + s.used.goodDeals, 0);

  return (
    <SiteShell>
      <nav className="pb-4 pt-2 text-sm text-muted" aria-label="Kruimelpad">
        <Link href="/modellen" className="hover:text-ink">
          Modellen
        </Link>
        {" / "}
        {entry.model}
      </nav>
      <header className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted">{content.tagline}</p>
          <h1 className="mt-2 text-4xl font-medium tracking-tight sm:text-5xl">Volvo {entry.model}</h1>
          <p className="mt-3 text-lg text-muted">
            {entry.count} te koop in {stats.map((s) => (s.country === "BE" ? "België" : "Nederland")).join(" en ")}, vanaf{" "}
            {formatEuro(entry.minPrice)}
            {totalDeals > 0 && ` · ${totalDeals} met een goede of scherpe prijs`}.
          </p>
          <div className="mt-5 space-y-3 leading-relaxed">
            {content.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {content.body && <Fact k="Type" v={content.body} />}
            {fuels.length > 0 && <Fact k="Aandrijving" v={fuels.join(", ")} />}
            {hp.length > 0 && <Fact k="Vermogen" v={`${Math.min(...hp)}–${Math.max(...hp)} pk`} />}
            {content.formerly && <Fact k="Vroeger" v={content.formerly} />}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {stats.map((s) => (
              <Link
                key={s.country}
                href={`/?${new URLSearchParams({ ...(s.country === "NL" ? { land: "nl" } : {}), model: s.model })}`}
                className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-85"
              >
                Bekijk alle {s.total} in {s.country === "BE" ? "België" : "Nederland"}
              </Link>
            ))}
          </div>
        </div>
        <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-tile">
          {entry.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.image} alt={`Volvo ${entry.model}`} className={`size-full ${entry.image.includes("hyperportal") || entry.image.includes("wizz") ? "object-contain" : "object-cover"}`} />
          )}
        </div>
      </header>

      {stats.map((s) => (
        <CountrySection key={s.country} s={s} deals={deals} showTitle={stats.length > 1} />
      ))}

      {content.tips.length > 0 && (
        <section className="mt-14 border-t border-line pt-10">
          <h2 className="text-2xl font-medium tracking-tight">Waar let je op bij een {entry.model}?</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {content.tips.map((t) => (
              <li key={t} className="rounded-xl bg-surface p-4 text-sm leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </SiteShell>
  );
}

function CountrySection({ s, deals, showTitle }: { s: ModelStats; deals: Map<string, Deal>; showTitle: boolean }) {
  const land = s.country === "NL" ? "Nederland" : "België";
  const search = (extra: Record<string, string> = {}) =>
    `/?${new URLSearchParams({ ...(s.country === "NL" ? { land: "nl" } : {}), model: s.model, ...extra })}`;

  return (
    <section className="mt-12 border-t border-line pt-10">
      {showTitle && <h2 className="mb-6 text-2xl font-medium tracking-tight">In {land}</h2>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Te koop" value={String(s.total)} sub={`${s.fresh.count} stock · ${s.used.count} tweedehands`} />
        <Tile
          label="Prijzen"
          value={s.used.minPrice != null || s.fresh.minPrice != null ? `vanaf ${formatEuro(Math.min(s.fresh.minPrice ?? Infinity, s.used.minPrice ?? Infinity))}` : "–"}
          sub={`mediaan ${formatEuro(median2(s.fresh.medianPrice, s.used.medianPrice) ?? 0)}`}
        />
        {s.fresh.count > 0 ? (
          <Tile
            label="Korting op stockwagens"
            value={s.fresh.discounted ? `${s.fresh.discounted} met korting` : "geen"}
            sub={
              s.fresh.medianDiscountPct != null
                ? `van de ${s.fresh.count} · typisch ${s.fresh.medianDiscountPct}% onder de adviesprijs`
                : undefined
            }
          />
        ) : (
          <Tile
            label="Tweedehands"
            value={s.used.medianKm != null ? `${s.used.medianKm.toLocaleString("nl-BE")} km` : "–"}
            sub={s.used.medianAge != null ? `mediaan · ${s.used.medianAge} jaar oud` : "mediaan kilometerstand"}
          />
        )}
        <Tile label="Goede en scherpe prijzen" value={String(s.fresh.goodDeals + s.used.goodDeals)} sub="volgens onze prijsvergelijking" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-surface p-5">
          <h3 className="mb-4 font-medium">Prijsverdeling</h3>
          <Bands fresh={s.fresh} used={s.used} />
        </div>
        <div className="grid gap-4 rounded-2xl bg-surface p-5 text-sm">
          <Breakdown title="Brandstof" rows={s.fuels} total={s.total} />
          <Breakdown title="Uitvoering" rows={s.trims} total={s.total} />
          <div>
            <h3 className="mb-2 font-medium">Kleur</h3>
            <div className="flex flex-wrap gap-2">
              {s.colors.map(([name, n]) => (
                <span key={name} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1">
                  <span
                    className="size-3 rounded-full ring-1 ring-black/10"
                    style={{ background: COLOR_FAMILIES.find((f) => f.name === name)?.hex ?? "conic-gradient(#c33,#cc3,#3c6,#36c,#c3c,#c33)" }}
                  />
                  {name} <span className="text-muted">{n}</span>
                </span>
              ))}
            </div>
          </div>
          {s.dealers.length > 0 && <Breakdown title="Meeste stock bij" rows={s.dealers} total={s.total} />}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {s.engines.length > 0 && (
          <div className="rounded-2xl bg-surface p-5">
            <h3 className="mb-3 font-medium">Motorversies te koop</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="pb-2 font-normal">Motor</th>
                  <th className="pb-2 font-normal">Vermogen</th>
                  <th className="pb-2 text-right font-normal">Aantal</th>
                  <th className="pb-2 text-right font-normal">Vanaf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.engines.map((e) => (
                  <tr key={`${e.powertrain}${e.fuel}`}>
                    <td className="py-2">
                      <Link
                        href={`/?${new URLSearchParams({ ...(s.country === "NL" ? { land: "nl" } : {}), model: s.model, powertrains: e.powertrain })}`}
                        className="font-medium hover:underline"
                      >
                        {e.powertrain}
                      </Link>
                      <span className="block text-xs text-muted">{e.fuel}</span>
                    </td>
                    <td className="py-2 tabular-nums">
                      {e.hpMin == null ? "–" : e.hpMin === e.hpMax ? `${e.hpMin} pk` : `${e.hpMin}–${e.hpMax} pk`}
                    </td>
                    <td className="py-2 text-right tabular-nums">{e.count}</td>
                    <td className="py-2 text-right tabular-nums">{formatEuro(e.fromPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {s.ageCurve.length >= 2 && (
          <div className="rounded-2xl bg-surface p-5">
            <h3 className="font-medium">Prijs per leeftijd (tweedehands)</h3>
            <p className="mb-3 text-sm text-muted">Mediaanprijs van de {s.model}&apos;s die nu te koop staan, per jaar sinds de eerste inschrijving.</p>
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="pb-2 font-normal">Leeftijd</th>
                  <th className="pb-2 text-right font-normal">Mediaanprijs</th>
                  <th className="pb-2 text-right font-normal">Kilometers</th>
                  <th className="pb-2 text-right font-normal">Aantal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.ageCurve.map((a) => (
                  <tr key={a.age}>
                    <td className="py-2">{a.age === 0 ? "< 1 jaar" : `${a.age}–${a.age + 1} jaar`}</td>
                    <td className="py-2 text-right tabular-nums">{formatEuro(a.medianPrice)}</td>
                    <td className="py-2 text-right tabular-nums">{a.medianKm != null ? `${Math.round(a.medianKm / 1000)}k km` : "–"}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{a.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {s.bestDeals.length > 0 && (
        <CardRow title="Beste deals" cars={s.bestDeals} deals={deals} more={{ href: search(), label: `Alle ${s.model}'s in ${land}` }} />
      )}
      <CardRow title="Goedkoopste" cars={s.cheapest} deals={deals} more={{ href: search(), label: `Alle ${s.total} bekijken` }} />
    </section>
  );
}

const median2 = (a: number | null, b: number | null) => (a != null && b != null ? Math.min(a, b) : (a ?? b));

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function Bands({ fresh, used }: { fresh: SegmentStats; used: SegmentStats }) {
  const keys = [...new Set([...fresh.bands, ...used.bands].map((b) => b.from))].sort((a, b) => a - b);
  const get = (s: SegmentStats, from: number) => s.bands.find((b) => b.from === from)?.count ?? 0;
  const max = Math.max(...keys.map((k) => get(fresh, k) + get(used, k)), 1);
  const short = (n: number) => `${Math.round(n / 1000)}k`;
  return (
    <div>
      <div className="flex h-44 items-end gap-1" role="img" aria-label="Aantal wagens per prijsklasse">
        {keys.map((k) => {
          const f = get(fresh, k);
          const u = get(used, k);
          const to = fresh.bands.find((b) => b.from === k)?.to ?? used.bands.find((b) => b.from === k)?.to ?? k;
          return (
            <div key={k} className="group flex h-full flex-1 flex-col justify-end" title={`${formatEuro(k)}–${formatEuro(to)}: ${f} stock, ${u} tweedehands`}>
              <div className="rounded-t-sm bg-accent" style={{ height: `${(f / max) * 100}%` }} />
              <div className="bg-muted/40" style={{ height: `${(u / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>€ {short(keys[0] ?? 0)}</span>
        <span>€ {short(keys.at(-1) ?? 0)}+</span>
      </div>
      <p className="mt-3 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" /> Stockwagens
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted/40" /> Tweedehands
        </span>
      </p>
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div>
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="grid gap-1.5">
        {rows.map(([name, n]) => (
          <li key={name} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <span className="relative overflow-hidden rounded-sm">
              <span className="absolute inset-y-0 left-0 bg-surface-2" style={{ width: `${(n / total) * 100}%` }} />
              <span className="relative block truncate px-2 py-0.5">{name}</span>
            </span>
            <span className="tabular-nums text-muted">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardRow({
  title,
  cars,
  deals,
  more,
}: {
  title: string;
  cars: import("@/lib/types").Listing[];
  deals: Map<string, Deal>;
  more: { href: string; label: string };
}) {
  if (!cars.length) return null;
  return (
    <div className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="text-xl font-medium">{title}</h3>
        <Link href={more.href} className="text-sm text-accent underline-offset-4 hover:underline">
          {more.label} →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cars.map((c) => (
          <ListingCard key={c.id} card={toCard(c, deals.get(c.id))} isNew={false} distance={null} />
        ))}
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
