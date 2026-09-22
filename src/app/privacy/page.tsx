import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { Prose } from "@/components/Prose";
import { SITE } from "@/lib/site";

// ⚠️ Concepttekst: laat deze privacyverklaring nakijken voor de site publiek gaat.

export const metadata: Metadata = { title: "Privacy en cookies | Vind een Volvo" };

export default function PrivacyPage() {
  return (
    <SiteShell>
      <Prose title="Privacy en cookies" intro="Versie van 22 september 2026.">
        <h2>Verantwoordelijke</h2>
        <p>
          {SITE.owner}, {SITE.address}, ondernemingsnummer {SITE.companyNumber}. Vragen over je gegevens:{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>

        <h2>Welke gegevens en waarom?</h2>
        <ul>
          <li>
            <strong>Zoeken zonder account</strong>: we verwerken geen persoonsgegevens. Je locatie of postcode voor
            &quot;dichtst bij mij&quot; blijft in je browser; een postcode wordt enkel omgezet naar coördinaten.
          </li>
          <li>
            <strong>Account</strong> (e-mailadres): om je in te loggen en je favorieten en meldingen te bewaren
            (uitvoering van de overeenkomst).
          </li>
          <li>
            <strong>Meldingen</strong>: je zoekcriteria en hoe vaak je een mail wil. Uitschrijven kan met één klik
            onderaan elke mail.
          </li>
          <li>
            <strong>Advertenties</strong>: gegevens van je wagen, foto&apos;s, telefoonnummer, postcode en gemeente, en
            voor bedrijven bedrijfsnaam en btw-nummer. Telefoonnummer, gemeente en bedrijfsgegevens zijn zichtbaar op de
            advertentie; je postcode gebruiken we enkel voor de afstand.
          </li>
        </ul>

        <h2>Hoe lang?</h2>
        <p>
          Zolang je account bestaat. Advertenties en hun foto&apos;s verwijder je zelf op elk moment; verlopen
          advertenties bewaren we maximaal 12 maanden. Vraag je je account te verwijderen, dan wissen we alles binnen 30
          dagen.
        </p>

        <h2>Met wie delen we gegevens?</h2>
        <p>
          We verkopen geen gegevens. We gebruiken verwerkers die gegevens enkel voor ons opslaan of versturen: Supabase
          (database, login en foto&apos;s), Vercel (hosting) en Resend (e-mail). [Vul de hostingregio&apos;s in en
          controleer de verwerkersovereenkomsten.] Postcodes worden omgezet naar coördinaten via OpenStreetMap
          Nominatim, zonder andere gegevens.
        </p>

        <h2>Cookies</h2>
        <p>
          We gebruiken enkel functionele opslag die nodig is om je ingelogd te houden en je voorkeuren te onthouden. Geen
          advertentie- of trackingcookies, dus geen cookiebanner nodig. Voegen we later statistieken toe, dan passen we
          deze tekst aan en vragen we toestemming waar nodig.
        </p>

        <h2>Je rechten</h2>
        <p>
          Je kan je gegevens inkijken, laten verbeteren of wissen, en bezwaar maken, via{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Ben je niet tevreden, dan kan je klacht indienen bij de
          Gegevensbeschermingsautoriteit (België) of de Autoriteit Persoonsgegevens (Nederland).
        </p>
      </Prose>
    </SiteShell>
  );
}
