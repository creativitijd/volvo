"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEuro } from "@/lib/format";
import type { PrivateListingRow } from "@/lib/private";
import { getSupabase } from "@/lib/supabase";
import { deletePhotos } from "@/lib/photos";
import { useAccount } from "./AccountProvider";
import { SignedOut } from "./SignedOut";

const DAY = 86_400_000;

const STATUS: Record<PrivateListingRow["status"] | "expired", { label: string; tone: string }> = {
  pending: { label: "Wordt nagekeken", tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  approved: { label: "Online", tone: "bg-save-bg text-save" },
  rejected: { label: "Afgewezen", tone: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  sold: { label: "Verkocht", tone: "bg-surface-2 text-muted" },
  expired: { label: "Verlopen", tone: "bg-surface-2 text-muted" },
};

export function MyAds() {
  const { user, ready } = useAccount();
  const [ads, setAds] = useState<PrivateListingRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    const { data } = await sb.from("private_listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setAds((data as PrivateListingRow[]) ?? []);
    setNow(Date.now());
  }, [user]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(id: string, fn: () => PromiseLike<unknown>) {
    setBusy(id);
    await fn();
    await load();
    setBusy(null);
  }

  if (!ready) return null;
  if (!user) return <SignedOut text="Log in om je advertenties te beheren." />;
  if (!ads) return <p className="text-muted">Laden…</p>;

  const sellLink = (
    <Link href="/verkopen" className="inline-block rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-bg">
      Nieuwe advertentie
    </Link>
  );

  if (!ads.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-12 text-center">
        <p className="mb-5 text-muted">Je hebt nog geen advertenties.</p>
        {sellLink}
      </div>
    );
  }

  const sb = getSupabase()!;

  return (
    <div className="grid gap-4">
      <div>{sellLink}</div>
      <ul className="grid gap-3">
        {ads.map((ad) => {
          const expires = ad.expires_at ? Date.parse(ad.expires_at) : null;
          const expired = ad.status === "approved" && expires !== null && expires < now;
          const status = STATUS[expired ? "expired" : ad.status];
          const daysLeft = expires ? Math.ceil((expires - now) / DAY) : null;
          const canRenew = ad.status === "approved" && daysLeft !== null && daysLeft <= 14;
          return (
            <li key={ad.id} className="flex flex-col gap-4 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center">
              <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-tile sm:w-40">
                {ad.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.photos[0]} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {ad.data.model} {ad.data.trim && ad.data.trim !== "Anders" ? ad.data.trim : ""}
                  </span>
                  <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                </div>
                <p className="text-sm text-muted">
                  {ad.data.regYear} · {ad.data.mileageKm.toLocaleString("nl-BE")} km · {formatEuro(ad.data.price)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {ad.status === "approved" && !expired && daysLeft !== null && `Nog ${daysLeft} ${daysLeft === 1 ? "dag" : "dagen"} online`}
                  {expired && "Niet meer zichtbaar. Verleng om ze terug online te zetten."}
                  {ad.status === "pending" && "Meestal binnen één werkdag nagekeken."}
                  {ad.status === "rejected" && `Reden: ${ad.reject_reason ?? "niet opgegeven"}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ad.status === "approved" && !expired && (
                  <Link href={`/particulier/${ad.id}`} className="rounded-md border border-line px-3.5 py-1.5 text-sm hover:border-ink">
                    Bekijk
                  </Link>
                )}
                {canRenew && (
                  <button
                    disabled={busy === ad.id}
                    onClick={() => act(ad.id, () => sb.rpc("renew_private_listing", { ad_id: ad.id }))}
                    className="rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-bg disabled:opacity-50"
                  >
                    Verleng 60 dagen
                  </button>
                )}
                {ad.status === "approved" && (
                  <button
                    disabled={busy === ad.id}
                    onClick={() => act(ad.id, () => sb.from("private_listings").update({ status: "sold" }).eq("id", ad.id))}
                    className="rounded-md border border-line px-3.5 py-1.5 text-sm hover:border-ink disabled:opacity-50"
                  >
                    Verkocht
                  </button>
                )}
                <button
                  disabled={busy === ad.id}
                  onClick={() => {
                    if (!confirm("Deze advertentie en haar foto's definitief verwijderen?")) return;
                    act(ad.id, async () => {
                      await sb.from("private_listings").delete().eq("id", ad.id);
                      await deletePhotos(sb, ad.photos);
                    });
                  }}
                  className="rounded-md px-3.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-red-600 disabled:opacity-50"
                >
                  Verwijder
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
