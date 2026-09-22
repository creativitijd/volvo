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
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {group.map((m) => (
                  <Link
                    key={m.model}
                    href={`/modellen/${modelSlug(m.model)}`}
                    className="min-w-0 overflow-hidden rounded-xl border border-[#ececeb] bg-white text-left transition hover:border-ink sm:w-[148px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={modelIconSrc(m.model)} alt="" className="mx-auto mt-1.5 h-12 w-[80%] object-contain sm:mt-2 sm:h-[78px]" />
                    <div className="flex flex-col items-center gap-0.5 px-1.5 pt-0.5 pb-2 sm:flex-row sm:justify-between sm:gap-1.5 sm:px-2.5 sm:pt-1 sm:pb-2.5">
                      <span className="text-center text-[12px] leading-tight font-semibold sm:truncate sm:text-left sm:text-[13.5px]">
                        {m.model.replace(" Cross Country", " CC")}
                      </span>
                      <span className="shrink-0 rounded-full bg-mark px-1.5 py-0.5 text-[10px] font-medium text-ink sm:text-[11px]">{m.count}</span>
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
