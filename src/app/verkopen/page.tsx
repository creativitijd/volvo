import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { SellForm } from "@/components/SellForm";

export const metadata: Metadata = {
  title: "Verkoop je Volvo | Vind een Volvo",
  description: "Zet je tweedehands Volvo gratis te koop, als particulier of bedrijf, bij kopers die specifiek een Volvo zoeken.",
};

export default function SellPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="pt-6 text-4xl font-medium tracking-tight">Verkoop je Volvo</h1>
        <p className="pb-8 pt-2 text-muted">
          Gratis voor particulieren en bedrijven. Je advertentie verschijnt tussen de stock- en Selekt-wagens, bij
          kopers die specifiek een Volvo zoeken.
        </p>
        <SellForm />
      </div>
    </SiteShell>
  );
}
