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
      className={`flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-ink ${liked ? "text-red-500" : ""}`}
    >
      <HeartIcon filled={liked} className="size-[18px]" />
      {liked ? "Bewaard" : "Bewaar"}
    </button>
  );
}
