import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { Prose } from "@/components/Prose";
import { SITE } from "@/lib/site";

// ⚠️ Concepttekst: laat deze voorwaarden nakijken door een jurist voor de site publiek gaat.

export const metadata: Metadata = { title: "Gebruiksvoorwaarden | Vind een Volvo" };

export default function TermsPage() {
  return (
    <SiteShell>
      <Prose title="Gebruiksvoorwaarden" intro="Versie van 22 september 2026.">
        <h2>1. Wie zijn we?</h2>
        <p>
          {SITE.name} ({SITE.url}) wordt uitgebaat door {SITE.owner}, {SITE.address}, ondernemingsnummer{" "}
          {SITE.companyNumber}. Contact: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>

        <h2>2. Wat biedt de site?</h2>
        <p>
          {SITE.name} verzamelt publiek beschikbare aanbiedingen van Volvo-wagens en toont advertenties van gebruikers. We
          zijn geen verkoper, tussenpersoon of partij bij een verkoop. Een koop sluit je altijd rechtstreeks af met de
          verkoper.
        </p>

        <h2>3. Juistheid van de gegevens</h2>
        <p>
          We doen ons best om prijzen, specificaties en beschikbaarheid correct over te nemen, maar ze komen van derden
          en kunnen fouten bevatten of intussen gewijzigd zijn. De prijsbeoordeling (&quot;Goede prijs&quot;,
          &quot;Scherpe prijs&quot;, …) is een automatische indicatie, geen taxatie of advies. Controleer alles bij de
          verkoper voor je beslist.
        </p>

        <h2>4. Account</h2>
        <p>
          Voor favorieten, meldingen en advertenties maak je een gratis account met je e-mailadres. Je bent
          verantwoordelijk voor wat er met je account gebeurt. Je kan je account op elk moment laten verwijderen via{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>

        <h2>5. Advertenties plaatsen</h2>
        <ul>
          <li>Je mag enkel Volvo&apos;s aanbieden die van jou of je bedrijf zijn en die echt te koop staan.</li>
          <li>Gegevens en foto&apos;s moeten kloppen en van de aangeboden wagen zijn. Je hebt het recht om ze te gebruiken.</li>
          <li>Bedrijven vermelden hun correcte bedrijfsnaam en btw-nummer en leven de regels voor verkoop aan consumenten na.</li>
          <li>
            We kijken elke advertentie na en kunnen ze zonder opgave van reden weigeren of verwijderen, bijvoorbeeld bij
            vermoeden van fraude.
          </li>
          <li>Een advertentie staat 60 dagen online en kan daarna verlengd worden. Markeer een verkochte wagen als verkocht.</li>
          <li>
            Je geeft ons de toelating om de inhoud van je advertentie op de site te tonen zolang ze online staat.
          </li>
        </ul>

        <h2>6. Wat niet mag</h2>
        <ul>
          <li>De site of haar gegevens automatisch uitlezen (scrapen) of massaal kopiëren.</li>
          <li>Misleidende, onwettige of beledigende inhoud plaatsen.</li>
          <li>Contactgegevens van verkopers gebruiken voor iets anders dan vragen over de aangeboden wagen.</li>
        </ul>

        <h2>7. Aansprakelijkheid</h2>
        <p>
          {SITE.name} is niet aansprakelijk voor de inhoud van advertenties en aanbiedingen van derden, voor de
          uitvoering van een verkoop, of voor schade door het (tijdelijk) niet beschikbaar zijn van de site, behalve bij
          opzet of grove fout.
        </p>

        <h2>8. Merken</h2>
        <p>
          Volvo en Volvo Selekt zijn merken van Volvo Car Corporation. {SITE.name} is een onafhankelijke site en is niet
          verbonden met, goedgekeurd door of gesponsord door Volvo.
        </p>

        <h2>9. Toepasselijk recht</h2>
        <p>
          Op deze voorwaarden is het Belgisch recht van toepassing. Zie ook onze <Link href="/privacy">privacyverklaring</Link>.
        </p>
      </Prose>
    </SiteShell>
  );
}
