import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// Goedkeuren/afwijzen van particuliere advertenties door een beheerder.
// De rechten worden in de database afgedwongen (RLS: is_admin()); deze route geeft de gebruikerstoken door
// en ververst daarna meteen de gecachete pagina's.

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string; action?: string; reason?: string } | null;
  if (!body?.id || !["approve", "reject"].includes(body.action ?? "")) {
    return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  const sb = createClient(url, key, {
    global: { headers: { authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) return Response.json({ error: "Geen beheerder" }, { status: 403 });

  const update =
    body.action === "approve"
      ? { status: "approved", reject_reason: null }
      : { status: "rejected", reject_reason: (body.reason ?? "").slice(0, 500) || "Voldoet niet aan de voorwaarden" };
  const { error } = await sb.from("private_listings").update(update).eq("id", body.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  revalidateTag("listings", "max");
  return Response.json({ ok: true });
}
