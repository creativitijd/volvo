# Vind een Volvo

Onafhankelijke site met nieuwe Volvo's op stock, gecertificeerde tweedehands Volvo's (Volvo Selekt) en
nagekeken advertenties van particulieren, in België en Nederland. Dagelijks bijgewerkt.
Geïnspireerd op [findapolestar.com](https://findapolestar.com).

## Hoe het werkt

```
volvostock.be ──(dagelijks, GitHub Actions)──▶ scripts/scrape-be.ts ──▶ Supabase ──▶ Next.js op Vercel
                                                      └──▶ data/listings.json (lokale fallback)
```

- **Scraper** (`scripts/scrape-be.ts`): leest de ingebedde `__NEXT_DATA__` van elke stockpagina
  op volvostock.be (21 wagens per pagina, 1,2 s pauze tussen pagina's), normaliseert naar het
  gedeelde `Listing`-model (`src/lib/types.ts`) en houdt `firstSeen` en prijswijzigingen bij.
- **Opslag**: Supabase-tabellen `listings` (actuele stock, JSONB) en `price_history`.
  Zonder Supabase-config gebruikt alles `data/listings.json`.
- **Site**: één pagina die elk uur opnieuw opgebouwd wordt (ISR); de bronnen worden één keer per dag gesynchroniseerd. Filteren en sorteren gebeurt in
  de browser; filters staan in de URL zodat je zoekopdrachten kan delen.

## Lokaal draaien

```bash
npm install
npm run scrape   # haalt verse data op naar data/listings.json
npm run dev
```

## Live zetten

1. **Supabase** (supabase.com): maak een project aan en voer `supabase/schema.sql` uit in de SQL Editor.
   - *Authentication → URL Configuration*: zet **Site URL** op je domein en voeg
     `https://<jouw-domein>/auth/callback` (en `http://localhost:3000/auth/callback`) toe bij **Redirect URLs**.
   - *Authentication → Emails → SMTP*: koppel Resend als SMTP-server (host `smtp.resend.com`, poort 465,
     gebruiker `resend`, wachtwoord = je Resend API key). De ingebouwde Supabase-mailer verstuurt maar een paar
     inlogmails per uur en is enkel bedoeld om te testen.
2. **Resend** (resend.com): verifieer je domein (DNS-records) en maak een API key.
3. **GitHub**: push deze map naar een (private) repo. Zet onder *Settings → Secrets → Actions*:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ALERT_FROM`, `SITE_URL`,
   en optioneel `REVALIDATE_URL` (`https://<jouw-domein>/api/revalidate`) + `REVALIDATE_SECRET`.
   Start de workflow *Scrape stock* één keer manueel om de database te vullen.
4. **Vercel**: importeer de repo, zet `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   `REVALIDATE_SECRET` als environment variables. **Niet** de service role key.

## Accounts, favorieten en meldingen

- Inloggen gaat met een e-maillink (geen wachtwoord). Supabase Auth maakt het account automatisch aan.
- Favorieten (`favorites`) en meldingen (`alerts`) zijn met Row Level Security afgeschermd: iedereen ziet
  enkel zijn eigen rijen.
- `scripts/send-alerts.ts` draait dagelijks na de scrapers (±7u–8u). Dagelijkse meldingen gaan vanaf 7u uit, wekelijkse op
  maandag vanaf 7u, enkel als er nieuwe wagens zijn (`firstSeen` na de vorige mail).
  Voorbeeldmail bekijken: `node scripts/send-alerts.ts --preview` → `data/mail-preview.html`.
- Elke mail heeft een uitschrijflink (`/uitschrijven?token=…`) die zonder inloggen werkt.

## Eigen advertenties (particulieren en bedrijven)

- Particulieren én bedrijven (met bedrijfsnaam + btw-nummer, gecontroleerd op formaat) plaatsen hun Volvo via **/verkopen** (inloggen vereist). Foto's worden in de browser verkleind
  (max. 1600 px) en opgeslagen in de Supabase Storage-bucket `listing-photos`.
- Elke advertentie wacht op goedkeuring op **/beheer**. Maak jezelf beheerder in de SQL Editor:
  `insert into admins (user_id) select id from auth.users where email = '<jouw e-mailadres>';`
  (log eerst één keer in op de site, zodat je account bestaat). Zet `ADMIN_EMAIL` als GitHub-secret om een mail
  te krijgen bij nieuwe advertenties.
- Goedgekeurde advertenties staan 60 dagen online, met een eigen pagina (**/particulier/[id]**) en het
  telefoonnummer achter een "Toon telefoonnummer"-knop. 5 dagen voor het einde krijgt de verkoper een mail;
  op **/mijn-advertenties** verlengt hij met één klik, markeert als verkocht of verwijdert.
- Gereserveerde Volvo Selekt-wagens krijgen een label, staan achteraan en worden nooit gemaild in meldingen.
- De kleurfilter werkt met kleurfamilies (Zwart, Grijs, Zilver, Wit, Blauw, Groen, Rood, Beige, Geel): zie
  `COLOR_FAMILIES` in `src/lib/format.ts`. De kaarten tonen wel de exacte Volvo-kleur.
- Beveiliging zit in de database: RLS + een trigger voorkomen dat verkopers hun advertentie zelf goedkeuren of de
  vervaldatum verzetten; inhoud wijzigen zet een advertentie terug op "wordt nagekeken".

## Bronnen

| Bron | Wat | Hoe |
|---|---|---|
| volvostock.be | Nieuwe stockwagens (±730) | `scripts/scrape-be.ts`: `__NEXT_DATA__` per lijstpagina, gewone HTTP |
| selekt.volvocars.be | 🇧🇪 Tweedehands Volvo Selekt (±900) | `scripts/scrape-selekt.ts --market=be`: sitemap → elke wagenpagina in headless Chrome, JSON die de pagina zelf ontvangt |
| selekt.volvocars.nl | 🇳🇱 Tweedehands Volvo Selekt (±3.800) | `scripts/scrape-selekt.ts --market=nl --concurrency=2`: idem; provincie via OpenStreetMap (gecachet in `data/geo-cache.json`) |
| volvocars.com/nl/inventory | 🇳🇱 Nieuwe stockwagens | **Niet gescraped**: Volvo weigert geautomatiseerde browsers (403). `scripts/scrape-nl.ts` staat klaar voor als er toestemming komt; tot dan linkt de site door. |
| AutoScout24, 2dehands, Marktplaats | — | **Niet gescraped** (robots.txt + voorwaarden + EU-databankenrecht, zie HvJ C‑202/12 Innoweb). De site linkt door naar hun zoekpagina met dezelfde filters. |

Volvo Selekt respecteert de robots.txt: lijstpagina's met `?` worden niet opgevraagd, enkel de sitemap en de
wagenpagina's. Eén run per dag: verkochte wagens verdwijnen via de sitemap; nieuwe wagens + een beperkt aantal bestaande (ouder dan 5 dagen, voor prijswijzigingen) worden geopend, met 1,5 s pauze;
afbeeldingen, chat en financieringsaanvragen worden geblokkeerd. De eerste volledige import duurt ±1u45
(lokaal: `node scripts/scrape-selekt.ts --max=1000 --minutes=150`).

## Fase 2 — meer bronnen

Elke bron krijgt een eigen script in `scripts/` dat naar hetzelfde `Listing`-model schrijft
(`source` = `volvo_nl`, `2dehands`, `autoscout24`, ...). Aandachtspunten:

- **Volvo NL** (`volvocars.com/nl/inventory`): Akamai-botbescherming → headless browser (Playwright) nodig.
  Data zit als JSON-LD in de pagina.
- **2dehands / AutoScout24**: hun gebruiksvoorwaarden verbieden scrapen en ze blokkeren bots actief.
  Onderzoek eerst officiële feeds/partner-API's.
- **Ontdubbelen**: dezelfde wagen staat vaak op meerdere sites. Match op `vin`, anders op
  model + bouwjaar + kilometerstand + kleur + postcode.
