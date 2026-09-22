"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/lib/card";
import { EMPTY_CRITERIA, describe, matches, toSearchParams, type Criteria } from "@/lib/filters";
import { getSupabase } from "@/lib/supabase";
import { useAccount } from "./AccountProvider";
import { SignedOut } from "./SignedOut";

interface Alert {
  id: string;
  criteria: Criteria;
  frequency: "daily" | "weekly";
  last_sent_at: string | null;
  created_at: string;
}

export function AlertsView({ cards }: { cards: Card[] }) {
  const { user, ready } = useAccount();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    sb.from("alerts")
      .select("id, criteria, frequency, last_sent_at, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) =>
        setAlerts(((data as Alert[]) ?? []).map((a) => ({ ...a, criteria: { ...EMPTY_CRITERIA, ...a.criteria } }))),
      );
  }, [user]);

  async function setFrequency(id: string, frequency: Alert["frequency"]) {
    setAlerts((prev) => prev?.map((a) => (a.id === id ? { ...a, frequency } : a)) ?? null);
    await getSupabase()?.from("alerts").update({ frequency }).eq("id", id);
  }

  async function remove(id: string) {
    setAlerts((prev) => prev?.filter((a) => a.id !== id) ?? null);
    await getSupabase()?.from("alerts").delete().eq("id", id);
  }

  if (!ready) return null;
  if (!user) return <SignedOut text="Log in om je meldingen te beheren." />;
  if (!alerts) return <p className="text-muted">Laden…</p>;

  if (!alerts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-12 text-center">
        <p className="text-muted">Je hebt nog geen meldingen.</p>
        <p className="mt-1 text-sm text-muted">
          Stel je filters in op de zoekpagina en klik op <strong>Bewaar als melding</strong>.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-bg">
          Naar de wagens
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {alerts.map((a) => {
        const count = cards.filter((c) => matches(c, a.criteria)).length;
        const qs = toSearchParams(a.criteria).toString();
        return (
          <li key={a.id} className="flex flex-col gap-4 rounded-2xl bg-surface p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{describe(a.criteria)}</p>
              <p className="mt-1 text-sm text-muted">
                {count} {count === 1 ? "wagen" : "wagens"} op stock nu
                {a.last_sent_at &&
                  ` · laatste mail ${new Date(a.last_sent_at).toLocaleDateString("nl-BE", { day: "numeric", month: "long" })}`}
                {" · "}
                <Link href={qs ? `/?${qs}` : "/"} className="underline underline-offset-4 hover:text-ink">
                  Bekijk
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md bg-surface-2 p-1 text-sm" role="group" aria-label="Hoe vaak">
                {(
                  [
                    ["daily", "Dagelijks"],
                    ["weekly", "Wekelijks"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setFrequency(a.id, v)}
                    aria-pressed={a.frequency === v}
                    className={`rounded-md px-3 py-1 transition ${
                      a.frequency === v ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => remove(a.id)}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-red-600"
              >
                Verwijder
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
