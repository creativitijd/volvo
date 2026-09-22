import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SIDE = 1600;

/** Verkleint een foto in de browser tot max. 1600 px en JPEG (±300 kB i.p.v. vaak 5+ MB). */
export async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Foto verwerken lukte niet"))), "image/jpeg", 0.82),
  );
}

async function bearer(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Niet ingelogd");
  return `Bearer ${token}`;
}

/** Uploadt via de site naar de Sevalla-bucket en geeft de publieke URL terug. */
export async function uploadPhoto(sb: SupabaseClient, _userId: string, file: File): Promise<string> {
  const blob = await shrink(file);
  const body = new FormData();
  body.append("file", blob, "photo.jpg");
  const res = await fetch("/api/photos", { method: "POST", headers: { authorization: await bearer(sb) }, body });
  const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !json?.url) throw new Error(json?.error ?? "Uploaden mislukt");
  return json.url;
}

/** Verwijdert foto's uit de Sevalla-bucket. Enkel de eigen map wordt geaccepteerd. */
export async function deletePhotos(sb: SupabaseClient, urls: string[]) {
  if (!urls.length) return;
  const res = await fetch("/api/photos", {
    method: "DELETE",
    headers: { authorization: await bearer(sb), "content-type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? "Foto's verwijderen lukte niet");
  }
}
