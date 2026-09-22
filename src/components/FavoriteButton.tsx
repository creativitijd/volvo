"use client";

import type { Card } from "@/lib/card";
import { useAccount } from "./AccountProvider";
import { HeartIcon } from "./AccountMenu";

export function FavoriteButton({ card }: { card: Card }) {
  const { favorites, toggleFavorite } = useAccount();
  const liked = favorites.has(card.id);
  return (
    <button
      onClick={() => toggleFavorite(card)}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 rounded-full border px-[18px] py-2.5 text-[13.5px] ${liked ? "border-ink text-[#d8232a]" : "border-[#e3e3e3] hover:border-ink"}`}
    >
      <HeartIcon filled={liked} className="size-[18px]" />
      {liked ? "Bewaard" : "Bewaar"}
    </button>
  );
}
