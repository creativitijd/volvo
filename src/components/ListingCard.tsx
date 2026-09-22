"use client";

import Link from "next/link";
import type { Card } from "@/lib/card";
import { formatEuro } from "@/lib/format";
import { SourceBadge } from "./SourceBadge";
import { useAccount } from "./AccountProvider";
import { HeartIcon } from "./AccountMenu";

export function ListingCard({
  card: c,
  isNew,
  distance,
}: {
  card: Card;
  isNew: boolean;
  distance: number | null;
}) {
  const { favorites, toggleFavorite } = useAccount();
  const liked = favorites.has(c.id);
  const saving = c.listPrice && c.listPrice > c.price ? c.listPrice - c.price : 0;
  const used = c.condition === "used";
  const year = used ? (c.regYear ?? c.year) : c.year;
  const fuelShort = c.fuel.split(" ")[0];
  const specs = [
    { k: "Bouwjaar", v: year ? String(year) : "—" },
    { k: "Km-stand", v: c.mileageKm != null ? c.mileageKm.toLocaleString("nl-BE") : used ? "—" : "Nieuw" },
    { k: "Brandstof", v: fuelShort || "—" },
    { k: "Vermogen", v: c.hp ? `${c.hp} pk` : c.powertrain || "—" },
  ];
  const place = [c.city, distance != null ? `${Math.round(distance)} km` : null].filter(Boolean).join(" · ");

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[18px] border border-[#e9e9e9] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(23,26,24,0.11)]">
      <Link href={c.page} className="flex flex-1 flex-col">
        <div className="relative aspect-[1.79] overflow-hidden bg-[#ededed]">
          {c.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.image}
              alt={`${c.model} in ${c.color ?? "onbekende kleur"}`}
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          )}
          {(c.reserved || isNew) && (
            <div className="absolute top-3 left-3 flex gap-1.5">
              {c.reserved && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-black">GERESERVEERD</span>}
              {isNew && !c.reserved && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">NIEUW</span>}
            </div>
          )}
          <div className="absolute bottom-2.5 left-2.5">
            <SourceBadge source={c.source} business={c.business} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 px-[18px] pt-4 pb-[18px]">
          <div>
            <div className="truncate text-base font-semibold">
              {c.model} {c.trim}
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-muted">
              {[c.color, c.interior].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="font-serif text-[25px] leading-none font-normal whitespace-nowrap">{formatEuro(c.price)}</span>
              {saving > 0 && (
                <span className="text-[12.5px] whitespace-nowrap text-[#9a9a9a] line-through">{formatEuro(c.listPrice!)}</span>
              )}
            </div>
            {saving > 0 && (
              <span className="rounded-[5px] bg-save-bg px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-save">
                −{formatEuro(saving)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 border-y border-[#efefef] py-2.5">
            {specs.map((s) => (
              <div key={s.k} className="min-w-0">
                <div className="text-[9.5px] tracking-[0.07em] text-[#a8a8a8] uppercase">{s.k}</div>
                <div className="mt-0.5 truncate text-[13px]">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2.5">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] leading-snug">{c.dealer || "Verkoper"}</div>
              <div className="truncate text-xs text-muted">{place || "—"}</div>
            </div>
            <span className="rounded-full border border-[#e3e3e3] px-3.5 py-2 text-[12.5px] whitespace-nowrap transition group-hover:border-ink group-hover:bg-ink group-hover:text-white">
              Bekijk
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggleFavorite(c)}
        aria-pressed={liked}
        aria-label={liked ? "Verwijder uit favorieten" : "Bewaar als favoriet"}
        className={`absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white shadow-[0_2px_6px_rgba(23,26,24,0.14)] transition hover:scale-105 ${
          liked ? "text-[#d8232a]" : "text-ink"
        }`}
      >
        <HeartIcon filled={liked} className="size-[18px]" />
      </button>
    </div>
  );
}
