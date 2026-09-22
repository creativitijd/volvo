"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEuro } from "@/lib/format";
import type { PrivateListingRow } from "@/lib/private";
import { getSupabase } from "@/lib/supabase";
import { useAccount } from "./AccountProvider";
import { SignedOut } from "./SignedOut";

const REASONS = [
  "Geen Volvo",
  "Bedrijfsgegevens of btw-nummer kloppen niet",
  "Foto's ontbreken of zijn niet van de wagen",
  "Prijs of gegevens lijken niet te kloppen",
  "Verdacht van oplichting",
];

/** De advertentie plus het telefoonnummer uit de aparte tabel */
type PendingAd = PrivateListingRow & { private_listing_phones?: { phone: string }[] };

export function Moderation() {
  const { user, ready } = useAccount();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ads, setAds] = useState<PendingAd[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    const { data: admin } = await sb.rpc("is_admin");
    setIsAdmin(Boolean(admin));
    if (!admin) return;
    const { data } = await sb
      .from("private_listings")
      .select("*, private_listing_phones(phone)")
      .eq("status", "pending")
      .order("created_at");
    setAds((data as PendingAd[]) ?? []);
  }, [user]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function decide(id: string, action: "approve" | "reject", reason?: string) {
    const sb = getSupabase();
    const token = (await sb?.auth.getSession())?.data.session?.access_token;
    if (!token) return;
    setBusy(id);
    setError(null);
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action, reason }),
    });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Er ging iets mis");
    await load();
    setBusy(null);
  }

  if (!ready) return null;
  if (!user) return <SignedOut text="Log in als beheerder." />;
  if (isAdmin === null) return <p className="text-muted">Laden…</p>;
  if (!isAdmin) return <p className="text-muted">Deze pagina is enkel voor beheerders.</p>;
  if (!ads?.length) return <p className="rounded-2xl bg-surface p-8 text-center text-muted">Niets na te kijken. 🎉</p>;

  return (
    <div className="grid gap-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ads.map((ad) => (
        <article key={ad.id} className="grid gap-4 rounded-2xl bg-surface p-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-3 gap-2">
            {ad.photos.map((src) => (
              <a key={src} href={src} target="_blank" rel="noopener" className="aspect-[4/3] overflow-hidden rounded-lg bg-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </a>
            ))}
          </div>
          <div className="grid content-start gap-3 text-sm">
            <div>
              <h2 className="text-xl font-medium">
                {ad.data.model} {ad.data.trim} {ad.data.powertrain}
              </h2>
              <p className="text-muted">
                Ingestuurd {new Date(ad.created_at).toLocaleString("nl-BE", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Spec k="Prijs" v={formatEuro(ad.data.price)} />
              <Spec k="Kilometerstand" v={`${ad.data.mileageKm.toLocaleString("nl-BE")} km`} />
              <Spec k="Inschrijving" v={String(ad.data.regYear)} />
              <Spec k="Brandstof" v={ad.data.fuel} />
              <Spec k="Kleur" v={ad.data.color} />
              <Spec k="Versnelling" v={ad.data.transmission} />
              <Spec k="Locatie" v={`${ad.data.zip} ${ad.data.city}`} />
              <Spec k="Telefoon" v={ad.private_listing_phones?.[0]?.phone ?? "—"} />
              <Spec
                k="Verkoper"
                v={ad.data.sellerType === "business" ? `Bedrijf: ${ad.data.companyName} (${ad.data.vatNumber})` : "Particulier"}
              />
            </dl>
            <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3">{ad.data.description}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={busy === ad.id}
                onClick={() => decide(ad.id, "approve")}
                className="rounded-md bg-save px-5 py-2 font-medium text-white disabled:opacity-50"
              >
                Goedkeuren
              </button>
              <select
                disabled={busy === ad.id}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value === "__other" ? prompt("Reden van afwijzing (de verkoper krijgt deze te zien):") : e.target.value;
                  e.target.value = "";
                  if (v) decide(ad.id, "reject", v);
                }}
                className="rounded-md border border-line bg-surface px-4 py-2"
              >
                <option value="" disabled>
                  Afwijzen…
                </option>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
                <option value="__other">Andere reden…</option>
              </select>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
