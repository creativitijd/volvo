import { getMarket } from "@/lib/listings";
import { toCard } from "@/lib/card";
import { Finder } from "@/components/Finder";
import { SiteShell } from "@/components/SiteShell";

// Pagina elk uur opnieuw opbouwen: de data wijzigt dagelijks, maar goedgekeurde particuliere advertenties komen tussendoor
export const revalidate = 3600;

export default async function Home() {
  const { snapshot, deals } = await getMarket();
  const cards = snapshot.listings.map((l) => toCard(l, deals.get(l.id)));
  const count = cards.length.toLocaleString("nl-BE");

  const hero = (
    <p className="font-serif mt-6 max-w-[760px] text-[22px] leading-snug font-light tracking-tight text-[#3d3d3d] sm:text-[23px]">
      Alle{" "}
      <span className="font-sans inline-block translate-y-[-1px] rounded-full bg-mark px-3 py-0.5 align-middle text-[18px] font-semibold text-ink sm:text-[19px]">
        {count}
      </span>{" "}
      Volvo&apos;s in België en Nederland.
      <br />
      Steeds gratis en onafhankelijk.
    </p>
  );

  return (
    <SiteShell hero={hero}>
      <h1 className="sr-only">Zoek jouw Volvo: stockwagens, Volvo Selekt en particulieren in België en Nederland</h1>
      <Finder cards={cards} updatedAt={snapshot.updatedAt} />
    </SiteShell>
  );
}
