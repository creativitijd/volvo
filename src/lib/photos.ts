import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SIDE = 1600;
const BUCKET = "listing-photos";

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

/** Uploadt in de map van de gebruiker (vereist door de storage-policy) en geeft de publieke URL terug. */
export async function uploadPhoto(sb: SupabaseClient, userId: string, file: File): Promise<string> {
  const blob = await shrink(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Uploaden mislukt: ${error.message}`);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Verwijdert foto's aan de hand van hun publieke URL (enkel eigen foto's, afgedwongen door de policy). */
export async function deletePhotos(sb: SupabaseClient, urls: string[]) {
  const marker = `/object/public/${BUCKET}/`;
  const paths = urls.map((u) => u.split(marker)[1]).filter(Boolean);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
}
