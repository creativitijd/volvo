import type { Metadata } from "next";
import Link from "next/link";
import { getMarket } from "@/lib/listings";
import { formatEuro } from "@/lib/format";
import { allModels, modelSlug } from "@/lib/stats";
import { SiteShell } from "@/components/SiteShell";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Alle Volvo-modellen te koop | Vind een Volvo",
  description: "Overzicht van alle Volvo-modellen die in België en Nederland te koop staan, met aantallen en prijzen.",
};

export default async function ModelsPage() {
  const { snapshot } = await getMarket();
  const models = allModels(snapshot.listings);
  return (
    <SiteShell>
      <h1 className="pt-6 text-4xl font-medium tracking-tight">Alle modellen</h1>
      <p className="pb-8 pt-2 text-muted">Kies een model voor prijzen, aantallen en de beste deals op dit moment.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {models.map((m) => (
          <Link
            key={m.model}
            href={`/modellen/${modelSlug(m.model)}`}
            className="group overflow-hidden rounded-xl border border-line bg-surface transition hover:border-muted hover:shadow-sm"
          >
            <div className="aspect-[16/9] overflow-hidden bg-tile">
              {m.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" />
              )}
            </div>
            <div className="p-3">
              <p className="font-medium">{m.model}</p>
              <p className="text-xs text-muted">
                {m.count} te koop · vanaf {formatEuro(m.minPrice)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </SiteShell>
  );
}
