import type { Metadata } from "next";
import { getMarket } from "@/lib/listings";
import { toCard } from "@/lib/card";
import { SiteShell } from "@/components/SiteShell";
import { FavoritesView } from "@/components/FavoritesView";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Mijn favorieten | Vind een Volvo" };

export default async function FavoritesPage() {
  const { snapshot, deals } = await getMarket();
  return (
    <SiteShell>
      <h1 className="pb-6 pt-6 text-4xl font-medium tracking-tight">Mijn favorieten</h1>
      <FavoritesView cards={snapshot.listings.map((l) => toCard(l, deals.get(l.id)))} />
    </SiteShell>
  );
}
