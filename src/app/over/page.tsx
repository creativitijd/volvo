import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { Prose } from "@/components/Prose";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Over Vind een Volvo",
  description: "Hoe Vind een Volvo werkt: waar de wagens vandaan komen, hoe we prijzen vergelijken en wie erachter zit.",
};

export default function AboutPage() {
  return (
    <SiteShell>
      <Prose
        title="Over Vind een Volvo"
        intro="Eén plek om elke Volvo te vinden die in België en Nederland te koop staat, met eerlijke informatie over de prijs."
      >
        <h2>Waarom deze site?</h2>
        <p>
          Wie een Volvo zoekt, moet vandaag langs een handvol sites: de stocklijst van Volvo, Volvo Selekt in België,
          Volvo Selekt in Nederland en de websites van verdelers. Vind een Volvo zet alles samen, maakt het doorzoekbaar
          en laat zien of een prijs scherp is of niet.
        </p>

        <h2>Waar komen de wagens vandaan?</h2>
        <ul>
          <li>
            <strong>Stockwagens</strong>: nieuwe, niet-ingeschreven Volvo&apos;s die al bij een Belgische verdeler staan
            (publieke stocklijst volvostock.be).
          </li>
          <li>
            <strong>Volvo Selekt</strong>: gecertificeerde tweedehands Volvo&apos;s van officiële verdelers in België en
            Nederland (selekt.volvocars.be en selekt.volvocars.nl).
          </li>
          <li>
            <strong>Eigen advertenties</strong>: particulieren en bedrijven die hun Volvo hier te koop zetten. We kijken
            elke advertentie na voor ze online komt.
          </li>
        </ul>
        <p>
          We synchroniseren de bronnen elke dag. Verkochte wagens verdwijnen binnen een dag; prijzen en beschikbaarheid
          kunnen tussendoor wijzigen. Controleer ze altijd bij de verkoper.
        </p>

        <h2>Hoe beoordelen we een prijs?</h2>
        <p>
          Voor tweedehands wagens berekenen we per model en brandstof wat een wagen van die leeftijd, kilometerstand en
          dat vermogen doorgaans kost. Voor nieuwe stockwagens vergelijken we met dezelfde configuratie (model, motor en
          uitvoering). Ligt de prijs duidelijk lager, dan tonen we <em>Goede prijs</em> of <em>Scherpe prijs</em>. Het
          is een indicatie op basis van de wagens die op dat moment te koop staan, geen taxatie.
        </p>

        <h2>Onafhankelijk</h2>
        <p>
          Vind een Volvo is niet verbonden met Volvo Cars, Volvo Car Belux, Volvo Car Nederland of een verdeler. We
          verkopen zelf geen wagens en krijgen geen commissie op een verkoop. De site is gratis voor kopers.
        </p>

        <h2>Contact</h2>
        <p>
          Vragen, een fout gezien of wil je als verdeler samenwerken? Mail naar{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
        <p className="text-sm text-muted">
          {SITE.owner} · {SITE.address} · {SITE.companyNumber} · <Link href="/voorwaarden">Gebruiksvoorwaarden</Link> ·{" "}
          <Link href="/privacy">Privacy en cookies</Link>
        </p>
      </Prose>
    </SiteShell>
  );
}
