import type { Criteria } from "@/lib/filters";

// We tonen geen advertenties van AutoScout24/2dehands (hun voorwaarden verbieden overnemen),
// maar sturen bezoekers door naar hun eigen zoekpagina met dezelfde filters ingevuld.

const slug = (model: string) => model.toLowerCase().replace(/\s+/g, "-");

export function autoscoutUrl(f: Criteria) {
  const nl = f.country === "NL";
  const p = new URLSearchParams({ atype: "C", cy: nl ? "NL" : "B" });
  if (f.maxPrice) p.set("priceto", String(f.maxPrice));
  if (f.maxKm) p.set("kmto", String(f.maxKm));
  const host = nl ? "https://www.autoscout24.nl" : "https://www.autoscout24.be/nl";
  return `${host}/lst/volvo${f.model ? `/${slug(f.model)}` : ""}?${p}`;
}

/** 2dehands (BE) en Marktplaats (NL) delen hetzelfde platform en URL-schema */
export function classifiedsUrl(f: Criteria) {
  const host = f.country === "NL" ? "https://www.marktplaats.nl" : "https://www.2dehands.be";
  return `${host}/l/auto-s/volvo/${f.model ? `q/${slug(f.model)}/` : ""}`;
}

export function ExternalSearch({ criteria }: { criteria: Criteria }) {
  const nl = criteria.country === "NL";
  return (
    <div className="flex flex-wrap gap-2.5">
      {nl && criteria.condition !== "used" && (
        <ExternalLink href="https://www.volvocars.com/nl/inventory/">Volvo NL ↗</ExternalLink>
      )}
      {criteria.condition !== "new" && (
        <>
          <ExternalLink href={autoscoutUrl(criteria)}>AutoScout24 ↗</ExternalLink>
          <ExternalLink href={classifiedsUrl(criteria)}>{nl ? "Marktplaats" : "2dehands"} ↗</ExternalLink>
        </>
      )}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener nofollow"
      className="rounded-full bg-white px-6 py-3.5 text-[14.5px] whitespace-nowrap transition hover:bg-[#f5f5f5]"
    >
      {children}
    </a>
  );
}
