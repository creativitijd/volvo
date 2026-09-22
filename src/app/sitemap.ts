import type { MetadataRoute } from "next";
import { pagePath } from "@/lib/card";
import { getMarket } from "@/lib/listings";
import { SITE } from "@/lib/site";
import { allModels, modelSlug } from "@/lib/stats";

// Eén keer per dag opnieuw opbouwen: de wagens wijzigen dagelijks
export const revalidate = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE.url}${path}`;
  const pages: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/?land=nl"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/modellen"), changeFrequency: "daily", priority: 0.8 },
    { url: url("/verkopen"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/over"), changeFrequency: "monthly", priority: 0.4 },
    { url: url("/voorwaarden"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const { snapshot } = await getMarket();
    const lastModified = new Date(snapshot.updatedAt || Date.now());

    for (const m of allModels(snapshot.listings)) {
      pages.push({ url: url(`/modellen/${modelSlug(m.model)}`), lastModified, changeFrequency: "daily", priority: 0.9 });
    }
    for (const car of snapshot.listings) {
      if (car.reserved) continue;
      pages.push({ url: url(pagePath(car)), lastModified, changeFrequency: "weekly", priority: 0.7 });
    }
  } catch (e) {
    // Zonder wagens blijft de sitemap geldig met enkel de vaste pagina's
    console.error("Sitemap: wagens ophalen mislukt", e);
  }

  return pages;
}
