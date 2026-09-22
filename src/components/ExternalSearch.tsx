import type { Criteria } from "@/lib/filters";

export function ExternalSearch({ criteria }: { criteria: Criteria }) {
  if (criteria.country !== "NL" || criteria.condition === "used") return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      <ExternalLink href="https://www.volvocars.com/nl/inventory/">Volvo NL ↗</ExternalLink>
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
