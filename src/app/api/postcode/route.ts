// Belgische of Nederlandse postcode → coördinaten (via OpenStreetMap Nominatim).
// Postcodes verhuizen niet: resultaten worden 30 dagen gecachet, zodat Nominatim nauwelijks belast wordt.

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const nl = params.get("land")?.toLowerCase() === "nl";
  const raw = params.get("pc")?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  // NL: "1234AB" of enkel "1234"; BE: 4 cijfers
  const valid = nl ? /^[1-9]\d{3}([A-Z]{2})?$/.test(raw) : /^[1-9]\d{3}$/.test(raw);
  if (!valid) {
    return Response.json(
      { error: nl ? "Geef een geldige Nederlandse postcode, bv. 1234 AB." : "Geef een geldige Belgische postcode (4 cijfers)." },
      { status: 400 },
    );
  }
  const pc = nl && raw.length === 6 ? `${raw.slice(0, 4)} ${raw.slice(4)}` : raw;

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pc)}&countrycodes=${nl ? "nl" : "be"}&format=json&limit=1&addressdetails=1`,
    {
      headers: { "user-agent": "VindEenVolvo/0.1 (+https://vindeenvolvo.be)", "accept-language": "nl" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    },
  );
  if (!res.ok) return Response.json({ error: "Postcode opzoeken lukt even niet." }, { status: 502 });

  const [hit] = (await res.json()) as { lat: string; lon: string; address?: Record<string, string> }[];
  if (!hit) return Response.json({ error: `Postcode ${pc} niet gevonden.` }, { status: 404 });

  const a = hit.address ?? {};
  return Response.json({
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    place: `${pc} ${a.town ?? a.city ?? a.village ?? a.municipality ?? ""}`.trim(),
    province: a.state ?? a.province ?? null,
  });
}
