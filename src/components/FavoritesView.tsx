"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toCard, type Card } from "@/lib/card";
import type { Listing } from "@/lib/types";
import { formatEuro } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useAccount } from "./AccountProvider";
import { ListingCard } from "./ListingCard";
import { SignedOut } from "./SignedOut";

interface Row {
  listing_id: string;
  snapshot: Card | null;
  created_at: string;
}

export function FavoritesView() {
  const { user, ready, favorites } = useAccount();
  const [rows, setRows] = useState<Row[] | null>(null);
  // Actuele gegevens van enkel de bewaarde wagens (prijs kan gewijzigd zijn, wagen kan verkocht zijn)
  const [current, setCurrent] = useState<Map<string, Card>>(new Map());

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("favorites")
        .select("listing_id, snapshot, created_at")
        .order("created_at", { ascending: false });
      const saved = (data as Row[]) ?? [];
      if (cancelled) return;
      setRows(saved);
      if (!saved.length) return setCurrent(new Map());
      const { data: live } = await sb
        .from("listings")
        .select("data")
        .eq("active", true)
        .in("id", saved.map((r) => r.listing_id));
      if (cancelled) return;
      const cards = ((live as { data: Listing }[]) ?? []).map((r) => toCard(r.data));
      setCurrent(new Map(cards.map((c) => [c.id, c])));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const byId = current;

  if (!ready) return null;
  if (!user) return <SignedOut text="Log in om je bewaarde wagens te zien." />;
  if (!rows) return <p className="text-muted">Laden…</p>;

  // Enkel rijen die nog steeds geliked zijn (unliken op deze pagina haalt ze meteen weg)
  const visible = rows.filter((r) => favorites.has(r.listing_id));
  const available = visible.map((r) => byId.get(r.listing_id)).filter((c): c is Card => Boolean(c));
  const gone = visible.filter((r) => !byId.has(r.listing_id) && r.snapshot);

  if (!visible.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-12 text-center">
        <p className="text-muted">Je hebt nog geen wagens bewaard.</p>
        <p className="mt-1 text-sm text-muted">Tik op het hartje bij een wagen om hem hier te bewaren.</p>
        <Link href="/" className="mt-5 inline-block rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-bg">
          Bekijk de wagens
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {available.length > 0 && (
        <section>
          <p className="mb-4 text-sm text-muted">
            {available.length} {available.length === 1 ? "wagen" : "wagens"} nog beschikbaar
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {available.map((c) => {
              const saved = visible.find((r) => r.listing_id === c.id)?.snapshot;
              return (
                <div key={c.id}>
                  <ListingCard card={c} isNew={false} distance={null} />
                  {saved && saved.price !== c.price && (
                    <p className={`mt-2 text-sm font-medium ${c.price < saved.price ? "text-save" : "text-muted"}`}>
                      {c.price < saved.price ? "Goedkoper" : "Duurder"} dan toen je hem bewaarde ({formatEuro(saved.price)})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {gone.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-medium">Niet meer beschikbaar</h2>
          <p className="mb-4 text-sm text-muted">Deze wagens zijn verkocht of uit de stock gehaald.</p>
          <div className="grid gap-4 opacity-60 grayscale sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gone.map((r) => (
              <ListingCard key={r.listing_id} card={r.snapshot!} isNew={false} distance={null} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
