import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { FavoritesView } from "@/components/FavoritesView";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Mijn favorieten | Vind een Volvo" };

export default function FavoritesPage() {
  return (
    <SiteShell>
      <h1 className="pb-6 pt-6 text-4xl font-medium tracking-tight">Mijn favorieten</h1>
      <FavoritesView />
    </SiteShell>
  );
}
