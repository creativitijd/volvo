import type { Metadata } from "next";
import Link from "next/link";
import { getMarket } from "@/lib/listings";
import { allModels, modelSlug } from "@/lib/stats";
import { SiteShell } from "@/components/SiteShell";
import { modelIconSrc, sortModels } from "@/components/ModelPicker";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Alle Volvo-modellen te koop | Vind een Volvo",
  description: "Overzicht van alle Volvo-modellen die in België en Nederland te koop staan, met aantallen en prijzen.",
};

export default async function ModelsPage() {
  const { snapshot } = await getMarket();
  const models = sortModels(allModels(snapshot.listings));
  const count = models.length.toLocaleString("nl-BE");
  const rows = new Map<number, typeof models>();
  for (const model of models) {
    const number = Number(model.model.match(/\d+/)?.[0] ?? 0);
    rows.set(number, [...(rows.get(number) ?? []), model]);
  }

  const hero = (
    <p className="font-serif mt-4 max-w-[760px] text-[18px] leading-snug font-light tracking-tight text-[#3d3d3d] sm:mt-6 sm:text-[23px]">
      Alle{" "}
      <span className="font-sans inline-block translate-y-[-1px] rounded-full bg-mark px-2.5 py-0.5 align-middle text-[15px] font-semibold text-ink sm:px-3 sm:text-[19px]">
        {count}
      </span>{" "}
      Volvo-modellen in België en Nederland.
      <br />
      Kies een model voor prijzen, aantallen en de beste deals.
    </p>
  );

  return (
    <SiteShell hero={hero}>
      <h1 className="sr-only">Alle Volvo-modellen te koop</h1>
      <div className="overflow-hidden rounded-3xl bg-[#f6f6f6] p-4 sm:p-5">
        <div className="grid gap-5">
          {[...rows.entries()].map(([number, group]) => (
            <div key={number}>
              <p className="mb-2 font-serif text-[22px] leading-none font-light tracking-tight text-[#3d3d3d]">{number}</p>
              <div className="flex gap-2 overflow-x-auto">
                {group.map((m) => (
                  <Link
                    key={m.model}
                    href={`/modellen/${modelSlug(m.model)}`}
                    className="w-[148px] shrink-0 overflow-hidden rounded-xl border border-[#ececeb] bg-white text-left transition hover:border-ink"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={modelIconSrc(m.model)} alt="" className="mx-auto mt-2 h-[78px] w-[76%] object-contain" />
                    <div className="flex items-center justify-between gap-1.5 px-2.5 pt-1 pb-2.5">
                      <span className="truncate text-[13.5px] font-semibold">{m.model.replace(" Cross Country", " CC")}</span>
                      <span className="shrink-0 rounded-full bg-mark px-1.5 py-0.5 text-[11px] font-medium text-ink">{m.count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
