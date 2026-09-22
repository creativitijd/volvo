import { getMarket } from "@/lib/listings";
import { matches, sanitizeCriteria } from "@/lib/filters";
import { toCard } from "@/lib/card";

/**
 * Telt hoeveel wagens er nu bij een bewaarde zoekopdracht passen.
 * Staat hier op de server: anders zou /meldingen alle wagens naar de browser moeten sturen.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { criteria?: unknown[] } | null;
  if (!Array.isArray(body?.criteria)) return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });

  const wanted = body.criteria.slice(0, 50).map(sanitizeCriteria);
  const { snapshot } = await getMarket();
  const cards = snapshot.listings.map((l) => toCard(l));
  return Response.json({ counts: wanted.map((c) => cards.filter((card) => matches(card, c)).length) });
}
