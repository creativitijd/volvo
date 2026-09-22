// Prijshistoriek per wagen: [tijdstip (ms), prijs][]. Een nieuw punt enkel als de prijs wijzigt.

import type { Listing } from "../src/lib/types.ts";

const MAX_POINTS = 60;

export function withHistory(cur: Listing, prev: Listing | undefined, now: number): Listing {
  const base: [number, number][] = prev
    ? (prev.priceHistory ?? [[prev.firstSeen, prev.price]])
    : [];
  const last = base.at(-1)?.[1];
  const history = last === cur.price ? base : [...base, [now, cur.price] as [number, number]];
  return {
    ...cur,
    firstSeen: prev?.firstSeen ?? cur.firstSeen,
    previousPrice: prev ? (prev.price !== cur.price ? prev.price : prev.previousPrice) : null,
    priceHistory: history.slice(-MAX_POINTS),
  };
}
