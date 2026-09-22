import { revalidateTag } from "next/cache";

// Aangeroepen door de scraper (GitHub Actions) na elke run, zodat de site meteen verse data toont.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag("listings", "max");
  return Response.json({ ok: true, at: Date.now() });
}
