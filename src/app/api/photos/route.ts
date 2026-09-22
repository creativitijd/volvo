import { createClient } from "@supabase/supabase-js";
import { photoKeyFromUrl, putPhoto, removePhoto } from "@/lib/object-storage";

const MAX_BYTES = 5 * 1024 * 1024;

async function userId(request: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;
  const sb = createClient(url, key, {
    global: { headers: { authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.auth.getUser(token);
  return data.user?.id ?? null;
}

export async function POST(request: Request) {
  const uid = await userId(request);
  if (!uid) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "image/jpeg") {
    return Response.json({ error: "Enkel JPEG" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "Foto is te groot" }, { status: 400 });

  try {
    const url = await putPhoto(`${uid}/${crypto.randomUUID()}.jpg`, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Uploaden mislukt" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const uid = await userId(request);
  if (!uid) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { urls?: unknown } | null;
  const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => typeof u === "string") : [];
  const keys = urls.map(photoKeyFromUrl).filter((key): key is string => Boolean(key) && key.startsWith(`${uid}/`));

  try {
    await Promise.all(keys.map((key) => removePhoto(key)));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Verwijderen mislukt" }, { status: 500 });
  }
}
