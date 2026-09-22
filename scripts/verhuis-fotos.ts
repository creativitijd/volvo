/**
 * Eenmalige verhuis: advertentiefoto's die nog in Supabase Storage staan naar de S3-bucket bij Sevalla.
 *
 * Nieuwe uploads gaan al rechtstreeks naar de bucket (src/lib/photos.ts → /api/photos). Dit script is er
 * enkel voor advertenties van vóór die omschakeling.
 *
 *   node scripts/verhuis-fotos.ts            # enkel tellen, niets wijzigen
 *   node scripts/verhuis-fotos.ts --verhuis  # downloaden, uploaden en de rijen bijwerken
 *
 * Nodig: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, S3_ENDPOINT, S3_BUCKET_NAME,
 *        S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, en (optioneel) S3_PUBLIC_URL, S3_REGION.
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { supabaseHeaders } from "./supabase.ts";

const DOEN = process.argv.includes("--verhuis");

interface Rij {
  id: string;
  user_id: string;
  photos: string[];
}

function nodig(naam: string): string {
  const waarde = process.env[naam]?.trim();
  if (!waarde) throw new Error(`Ontbrekende variabele ${naam}`);
  return waarde;
}

/** Een foto staat nog bij Supabase als de URL naar de opslag van hetzelfde project wijst */
const inSupabase = (url: string) => /\/storage\/v1\/object\/(public|sign)\//.test(url);

function publiekeBasis(): string {
  const bucket = nodig("S3_BUCKET_NAME");
  return (process.env.S3_PUBLIC_URL || `https://${bucket}.sevalla.storage`).replace(/\/$/, "");
}

async function alleAdvertenties(rest: string, headers: Record<string, string>): Promise<Rij[]> {
  const rijen: Rij[] = [];
  for (let van = 0; ; van += 500) {
    const res = await fetch(`${rest}/private_listings?select=id,user_id,photos&order=created_at`, {
      headers: { ...headers, range: `${van}-${van + 499}` },
    });
    if (!res.ok) throw new Error(`Advertenties ophalen: ${res.status} ${await res.text()}`);
    const blok: Rij[] = await res.json();
    rijen.push(...blok);
    if (blok.length < 500) return rijen;
  }
}

async function main() {
  const supabase = nodig("SUPABASE_URL").replace(/\/$/, "");
  const sleutel = nodig("SUPABASE_SERVICE_ROLE_KEY");
  const headers = supabaseHeaders(sleutel, { "content-type": "application/json" });
  const rest = `${supabase}/rest/v1`;

  const advertenties = await alleAdvertenties(rest, headers);
  const teVerhuizen = advertenties.filter((a) => (a.photos ?? []).some(inSupabase));
  const aantalFotos = teVerhuizen.reduce((n, a) => n + a.photos.filter(inSupabase).length, 0);

  console.log(`${advertenties.length} advertenties, ${aantalFotos} foto's nog in Supabase Storage.`);
  if (!aantalFotos) return console.log("✓ Niets te verhuizen — alle foto's staan al in de bucket.");
  if (!DOEN) return console.log("Draai opnieuw met --verhuis om ze te verplaatsen.");

  const basis = publiekeBasis();
  const s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: nodig("S3_ENDPOINT"),
    forcePathStyle: true,
    credentials: { accessKeyId: nodig("S3_ACCESS_KEY_ID"), secretAccessKey: nodig("S3_SECRET_ACCESS_KEY") },
  });

  let verhuisd = 0;
  let mislukt = 0;
  for (const ad of teVerhuizen) {
    const nieuw: string[] = [];
    for (const url of ad.photos) {
      if (!inSupabase(url)) {
        nieuw.push(url);
        continue;
      }
      try {
        const res = await fetch(url, { headers: { apikey: sleutel } });
        if (!res.ok) throw new Error(`downloaden: ${res.status}`);
        const key = `${ad.user_id}/${crypto.randomUUID()}.jpg`;
        await s3.send(
          new PutObjectCommand({
            Bucket: nodig("S3_BUCKET_NAME"),
            Key: key,
            Body: new Uint8Array(await res.arrayBuffer()),
            ContentType: res.headers.get("content-type") || "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
        nieuw.push(`${basis}/${key}`);
        verhuisd++;
      } catch (e) {
        // De oude URL blijft staan: de advertentie verliest geen foto door een mislukte verhuis
        console.error(`✗ ${ad.id}: ${e instanceof Error ? e.message : e}`);
        nieuw.push(url);
        mislukt++;
      }
    }

    // Enkel bijwerken als élke foto van deze advertentie mee is: anders blijft de rij ongewijzigd
    if (nieuw.some(inSupabase)) continue;
    const res = await fetch(`${rest}/private_listings?id=eq.${ad.id}`, {
      method: "PATCH",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify({ photos: nieuw }),
    });
    if (!res.ok) console.error(`✗ rij ${ad.id} bijwerken: ${res.status} ${await res.text()}`);
  }

  console.log(`✓ ${verhuisd} foto's verhuisd${mislukt ? `, ${mislukt} mislukt` : ""}.`);
  console.log("Controleer de site en verwijder daarna de bucket 'listing-photos' in Supabase.");
}

// Rechtstreeks aanroepen: het pad naar dit project bevat een spatie, waardoor de gebruikelijke
// import.meta.url-vergelijking niet opgaat.
await main();
