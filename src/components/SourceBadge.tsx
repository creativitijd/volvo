import type { Source } from "@/lib/types";

/** Per bron: hoe de herkomst op een kaart getoond wordt. */
const SOURCES: Record<Source, { label: string; short: string; official: boolean }> = {
  volvo_be: { label: "Volvo", short: "Volvo", official: true },
  volvo_selekt: { label: "Volvo Selekt", short: "Selekt", official: true },
  volvo_selekt_nl: { label: "Volvo Selekt", short: "Selekt", official: true },
  particulier: { label: "Particulier", short: "Particulier", official: false },
  volvo_nl: { label: "Volvo", short: "Volvo", official: true },
  "2dehands": { label: "2dehands", short: "2dehands", official: false },
  autoscout24: { label: "AutoScout24", short: "AutoScout24", official: false },
};

export function SourceBadge({ source, compact, business }: { source: Source; compact?: boolean; business?: boolean }) {
  const s = business ? { label: "Bedrijf", short: "Bedrijf", official: false } : SOURCES[source];
  return (
    <span
      title={
        s.official
          ? "Wagen van een erkende Volvo-verdeler"
          : source === "particulier"
            ? `Advertentie van ${business ? "een bedrijf" : "een particuliere verkoper"}, nagekeken door Vind een Volvo`
            : `Advertentie via ${s.label}`
      }
      className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10.5px] font-semibold whitespace-nowrap shadow-sm ${
        s.official ? "bg-[#1a4b8c] text-white" : "bg-white text-ink ring-1 ring-[#e3e3e3]"
      }`}
    >
      {s.official ? <ShieldCheck /> : <Tag />}
      {compact ? s.short : s.label}
    </span>
  );
}

function ShieldCheck() {
  return (
    <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M8 1.75 2.75 3.5v4c0 3.1 2.2 5.6 5.25 6.75 3.05-1.15 5.25-3.65 5.25-6.75v-4L8 1.75Z" strokeLinejoin="round" />
      <path d="m5.5 8 1.75 1.75L10.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tag() {
  return (
    <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M2 2.75v4.5l6.75 6.75 5.25-5.25L7.25 2H2.75A.75.75 0 0 0 2 2.75Z" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
