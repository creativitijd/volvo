import type { Metadata } from "next";
import { getMarket } from "@/lib/listings";
import { toCard } from "@/lib/card";
import { SiteShell } from "@/components/SiteShell";
import { AlertsView } from "@/components/AlertsView";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Mijn meldingen | Vind een Volvo" };

export default async function AlertsPage() {
  const { snapshot, deals } = await getMarket();
  return (
    <SiteShell>
      <h1 className="pt-6 text-4xl font-medium tracking-tight">Mijn meldingen</h1>
      <p className="pb-6 pt-2 text-muted">
        Je krijgt een mail wanneer er nieuwe wagens binnenkomen die bij je zoekopdracht passen.
      </p>
      <AlertsView cards={snapshot.listings.map((l) => toCard(l, deals.get(l.id)))} />
    </SiteShell>
  );
}
