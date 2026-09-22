// Verstuurt e-mailmeldingen voor nieuwe wagens die bij een bewaarde zoekopdracht passen.
// Gebruik: node scripts/send-alerts.ts   (draait dagelijks na de scrapers, zie .github/workflows/scrape.yml)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
//      RESEND_API_KEY + ALERT_FROM ("Vind een Volvo <meldingen@jouwdomein.be>")
// Zonder RESEND_API_KEY draait het script in testmodus: het toont de mails maar verstuurt niets.

import { countryOfSource, type Listing } from "../src/lib/types.ts";
import { EMPTY_CRITERIA, describe, matches, toSearchParams, type Criteria, type Matchable } from "../src/lib/filters.ts";
import { formatEuro, province } from "../src/lib/format.ts";
import { privateToListing, type PrivateListingRow } from "../src/lib/private.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.ALERT_FROM ?? "Vind een Volvo <onboarding@resend.dev>";
const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Meldingen worden verstuurd vanaf dit uur (Belgische tijd); wekelijkse op maandag. */
const SEND_FROM_HOUR = 7;
const MAX_CARS_IN_MAIL = 12;

interface Alert {
  id: string;
  user_id: string;
  criteria: Criteria;
  frequency: "daily" | "weekly";
  unsubscribe_token: string;
  last_sent_at: string | null;
  created_at: string;
}

const headers = { apikey: KEY!, authorization: `Bearer ${KEY}`, "content-type": "application/json" };

async function rest(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function brusselsNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    hour: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  return {
    hour: Number(parts.find((p) => p.type === "hour")!.value),
    weekday: parts.find((p) => p.type === "weekday")!.value, // "Mon", ...
  };
}

function isDue(alert: Pick<Alert, "frequency" | "last_sent_at">, now: Date): boolean {
  const { hour, weekday } = brusselsNow(now);
  if (hour < SEND_FROM_HOUR) return false;
  const last = alert.last_sent_at ? Date.parse(alert.last_sent_at) : 0;
  const hoursSince = (now.getTime() - last) / 3_600_000;
  if (alert.frequency === "daily") return hoursSince >= 20;
  return weekday === "Mon" && hoursSince >= 24 * 6;
}

const toMatchable = (l: Listing): Matchable => ({
  country: l.country ?? countryOfSource(l.source),
  province: l.dealer?.province ?? ((l.country ?? countryOfSource(l.source)) === "BE" ? province(l.dealer?.zip ?? null) : null),
  condition: l.condition,
  mileageKm: l.mileageKm,
  reserved: Boolean(l.reserved),
  model: l.model,
  fuel: l.fuel,
  color: l.color,
  trim: l.trim,
  powertrain: l.powertrain,
  drive: l.drive,
  packs: l.packs,
  price: l.price,
  year: l.modelYear,
  regYear: l.firstRegistration ? Number(l.firstRegistration.slice(0, 4)) || null : null,
});

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function renderMail(alert: Alert, cars: Listing[]) {
  const search = `${SITE_URL}/?${toSearchParams(alert.criteria).toString()}`;
  const unsubscribe = `${SITE_URL}/uitschrijven?token=${alert.unsubscribe_token}`;
  const title = describe(alert.criteria);
  const n = cars.length;
  const subject = `${n} nieuwe ${n === 1 ? "Volvo" : "Volvo's"}: ${title}`;

  const rows = cars
    .slice(0, MAX_CARS_IN_MAIL)
    .map((c) => {
      const saving = c.listPrice && c.listPrice > c.price ? c.listPrice - c.price : 0;
      return `
      <tr><td style="padding:0 0 16px">
        <a href="${esc(c.url)}" style="text-decoration:none;color:#141413;display:block;border:1px solid #dddcd6;border-radius:14px;overflow:hidden">
          ${c.images[0] ? `<img src="${esc(c.images[0])}" width="520" alt="" style="display:block;width:100%;height:auto;background:#e9e8e3">` : ""}
          <div style="padding:14px 16px">
            <div style="font-size:20px;font-weight:600">${formatEuro(c.price)}
              ${saving ? `<span style="font-size:13px;font-weight:600;color:#16794a;background:#e3f2e8;border-radius:99px;padding:3px 9px;margin-left:6px">Bespaar ${formatEuro(saving)}</span>` : ""}
            </div>
            <div style="font-size:15px;font-weight:500;margin-top:6px">${esc(`${c.model} ${c.trim ?? ""}`)}</div>
            <div style="font-size:13px;color:#6d6c67;margin-top:2px">${esc([c.modelYear, c.powertrain, c.color].filter(Boolean).join(" · "))}</div>
            <div style="font-size:13px;color:#6d6c67;margin-top:2px">${esc([c.dealer?.name, c.dealer?.city].filter(Boolean).join(", "))}</div>
          </div>
        </a>
      </td></tr>`;
    })
    .join("");

  const more = n > MAX_CARS_IN_MAIL ? `<p style="margin:0 0 16px"><a href="${esc(search)}" style="color:#1c3f94">Bekijk alle ${n} nieuwe wagens →</a></p>` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f4f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">
      <tr><td style="padding:0 0 20px;font-size:15px;font-weight:600">Vind een Volvo</td></tr>
      <tr><td style="padding:0 0 6px;font-size:24px;font-weight:600;color:#141413">${n} nieuwe ${n === 1 ? "wagen" : "wagens"} voor je zoekopdracht</td></tr>
      <tr><td style="padding:0 0 20px;font-size:14px;color:#6d6c67">${esc(title)}</td></tr>
      ${rows}
      <tr><td>${more}<p style="font-size:12px;color:#6d6c67;line-height:1.6;margin:8px 0 0">
        Je krijgt deze mail omdat je een ${alert.frequency === "daily" ? "dagelijkse" : "wekelijkse"} melding hebt op Vind een Volvo.
        <a href="${esc(`${SITE_URL}/meldingen`)}" style="color:#6d6c67">Meldingen beheren</a> ·
        <a href="${esc(unsubscribe)}" style="color:#6d6c67">Uitschrijven</a><br>
        Vind een Volvo is onafhankelijk en niet verbonden met Volvo Cars. Controleer prijs en beschikbaarheid bij de verdeler.
      </p></td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { subject, html, unsubscribe };
}

async function sendMail(to: string, subject: string, html: string, unsubscribe?: string) {
  if (!RESEND_API_KEY) {
    console.log(`  [testmodus] zou mailen naar ${to}: "${subject}"`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html,
      ...(unsubscribe && {
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
}

/** `node scripts/send-alerts.ts --preview`: toont een voorbeeldmail op basis van data/listings.json */
async function preview() {
  const { readFile, writeFile } = await import("node:fs/promises");
  const snap = JSON.parse(await readFile(new URL("../data/volvo_be.json", import.meta.url), "utf8"));
  const criteria: Criteria = { ...EMPTY_CRITERIA, model: "EX30", colors: ["Denim Blue"] };
  const cars = (snap.listings as Listing[]).filter((l) => matches(toMatchable(l), criteria)).sort((a, b) => a.price - b.price);
  const fake: Alert = {
    id: "preview",
    user_id: "preview",
    criteria,
    frequency: "daily",
    unsubscribe_token: "00000000-0000-0000-0000-000000000000",
    last_sent_at: null,
    created_at: new Date().toISOString(),
  };
  const { subject, html } = renderMail(fake, cars.slice(0, 3));
  const out = new URL("../data/mail-preview.html", import.meta.url);
  await writeFile(out, html);
  console.log(`Onderwerp: ${subject}\nVoorbeeld: ${decodeURIComponent(out.pathname)}`);
}

async function main() {
  if (process.argv.includes("--preview")) return preview();
  if (!SUPABASE_URL || !KEY) {
    console.log("(Supabase niet geconfigureerd — geen meldingen verstuurd)");
    return;
  }
  const now = new Date();
  await runAlerts(now);
  await runSellerMails(now);
}

const emailCache = new Map<string, string | null>();
async function emailOf(userId: string): Promise<string | null> {
  if (!emailCache.has(userId)) {
    const user = await rest(`/auth/v1/admin/users/${userId}`).catch(() => null);
    emailCache.set(userId, user?.email ?? null);
  }
  return emailCache.get(userId)!;
}

async function runAlerts(now: Date) {
  const alerts: Alert[] = await rest(
    "/rest/v1/alerts?select=id,user_id,criteria,frequency,unsubscribe_token,last_sent_at,created_at",
  );
  // Oudere meldingen missen nieuwere velden: aanvullen met de standaardwaarden
  for (const a of alerts) a.criteria = { ...EMPTY_CRITERIA, ...a.criteria };
  const due = alerts.filter((a) => isDue(a, now));
  console.log(`${alerts.length} meldingen, ${due.length} nu aan de beurt`);
  if (!due.length) return;

  const listings: Listing[] = [];
  for (let from = 0; ; from += 1000) {
    const rows: { data: Listing }[] = await rest("/rest/v1/listings?select=data&active=eq.true&order=id", {
      headers: { range: `${from}-${from + 999}` },
    });
    listings.push(...rows.map((r) => r.data));
    if (rows.length < 1000) break;
  }
  // Goedgekeurde particuliere advertenties tellen ook mee
  const ads: PrivateListingRow[] = await rest(
    `/rest/v1/private_listings?select=*&status=eq.approved&expires_at=gt.${encodeURIComponent(now.toISOString())}`,
  );
  listings.push(...ads.map((r) => privateToListing(r, SITE_URL)));

  let sent = 0;
  for (const alert of due) {
    const since = Date.parse(alert.last_sent_at ?? alert.created_at);
    const fresh = listings
      // Gereserveerde wagens nooit mailen: die zijn voor de ontvanger meestal al weg
      .filter((l) => l.firstSeen > since && !l.reserved && matches(toMatchable(l), alert.criteria))
      .sort((a, b) => a.price - b.price);

    if (fresh.length) {
      const to = await emailOf(alert.user_id);
      if (to) {
        const { subject, html, unsubscribe } = renderMail(alert, fresh);
        try {
          await sendMail(to, subject, html, unsubscribe);
          sent++;
        } catch (e) {
          console.error(`  Mail voor melding ${alert.id} mislukt:`, e);
          continue; // last_sent_at niet bijwerken, volgende run opnieuw proberen
        }
      }
    }

    // Ook zonder nieuwe wagens: het venster schuift op, zodat niemand dubbele wagens krijgt
    await rest(`/rest/v1/alerts?id=eq.${alert.id}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ last_sent_at: now.toISOString() }),
    });
  }
  console.log(`✓ ${sent} meldingsmails verstuurd`);
}

// ── Particuliere verkopers ──────────────────────────────────────────────────

const REMIND_DAYS = 5;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function simpleMail(title: string, paragraphs: string[], button?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f4f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#141413">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:16px">
      <tr><td style="padding:28px">
        <p style="margin:0 0 18px;font-size:15px;font-weight:600">Vind een Volvo</p>
        <h1 style="margin:0 0 14px;font-size:22px">${esc(title)}</h1>
        ${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${p}</p>`).join("")}
        ${button ? `<p style="margin:22px 0 0"><a href="${esc(button.href)}" style="display:inline-block;background:#141413;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:99px">${esc(button.label)}</a></p>` : ""}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function patchAd(id: string, fields: Record<string, unknown>) {
  await rest(`/rest/v1/private_listings?id=eq.${id}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(fields),
  });
}

async function runSellerMails(now: Date) {
  const iso = now.toISOString();
  const name = (r: PrivateListingRow) => esc(`${r.data.model} (${r.data.regYear})`);
  let sent = 0;

  // 1. Goedgekeurd of afgewezen, verkoper nog niet verwittigd
  const decided: PrivateListingRow[] = await rest(
    "/rest/v1/private_listings?select=*&status=in.(approved,rejected)&seller_notified_at=is.null",
  );
  for (const r of decided) {
    const to = await emailOf(r.user_id);
    if (to) {
      const approved = r.status === "approved";
      const html = approved
        ? simpleMail(
            "Je advertentie staat online",
            [
              `Goed nieuws: je advertentie voor je <strong>${name(r)}</strong> is nagekeken en staat nu online.`,
              `Ze blijft 60 dagen zichtbaar. Een paar dagen voor het einde krijg je een mail om te verlengen.`,
            ],
            { label: "Bekijk je advertentie", href: `${SITE_URL}/particulier/${r.id}` },
          )
        : simpleMail(
            "Je advertentie werd niet goedgekeurd",
            [
              `We konden je advertentie voor je <strong>${name(r)}</strong> helaas niet online zetten.`,
              `Reden: ${esc(r.reject_reason ?? "niet opgegeven")}.`,
              `Je kan de advertentie verwijderen en een nieuwe insturen.`,
            ],
            { label: "Mijn advertenties", href: `${SITE_URL}/mijn-advertenties` },
          );
      await sendMail(to, approved ? "Je Volvo staat online" : "Je advertentie werd niet goedgekeurd", html);
      sent++;
    }
    // Rechtstreeks via REST met de service role: de trigger laat dit toe
    await patchAd(r.id, { seller_notified_at: iso });
  }

  // 2. Herinnering: verloopt binnen REMIND_DAYS dagen
  const soon = new Date(now.getTime() + REMIND_DAYS * 86_400_000).toISOString();
  const expiring: PrivateListingRow[] = await rest(
    `/rest/v1/private_listings?select=*&status=eq.approved&reminder_sent_at=is.null&expires_at=gt.${encodeURIComponent(iso)}&expires_at=lt.${encodeURIComponent(soon)}`,
  );
  for (const r of expiring) {
    const to = await emailOf(r.user_id);
    if (to) {
      const until = new Date(r.expires_at!).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
      await sendMail(
        to,
        "Je advertentie verloopt binnenkort",
        simpleMail(
          "Je advertentie verloopt binnenkort",
          [
            `Je advertentie voor je <strong>${name(r)}</strong> staat nog online tot ${until}.`,
            `Nog niet verkocht? Verleng ze met één klik voor 60 dagen. Wel verkocht? Markeer ze dan als verkocht.`,
          ],
          { label: "Verlengen of als verkocht markeren", href: `${SITE_URL}/mijn-advertenties` },
        ),
      );
      sent++;
    }
    await patchAd(r.id, { reminder_sent_at: iso });
  }

  // 3. Beheerder: dagelijks overzicht van nieuwe advertenties om na te kijken (sinds de vorige run)
  if (ADMIN_EMAIL) {
    const since = new Date(now.getTime() - 25 * 3600_000).toISOString();
    const fresh: PrivateListingRow[] = await rest(
      `/rest/v1/private_listings?select=*&status=eq.pending&created_at=gt.${encodeURIComponent(since)}`,
    );
    if (fresh.length) {
      await sendMail(
        ADMIN_EMAIL,
        `${fresh.length} nieuwe advertentie${fresh.length === 1 ? "" : "s"} om na te kijken`,
        simpleMail(
          "Nieuwe advertenties om na te kijken",
          fresh.map((r) => `${name(r)} · ${formatEuro(r.data.price)} · ${esc(r.data.city)}`),
          { label: "Naar beheer", href: `${SITE_URL}/beheer` },
        ),
      );
      sent++;
    }
  }
  console.log(`✓ ${sent} verkopersmails verstuurd`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
