"use client";

import Link from "next/link";
import { useState } from "react";
import { describe, pickCriteria, type Criteria } from "@/lib/filters";
import { getSupabase } from "@/lib/supabase";
import { useAccount } from "./AccountProvider";
import { Modal } from "./Modal";

type Frequency = "daily" | "weekly";

export function SaveSearch({
  criteria,
  label = "Bewaar als melding",
  variant = "outline",
}: {
  criteria: Criteria;
  label?: string;
  variant?: "outline" | "solid";
}) {
  const { user, requireLogin } = useAccount();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function start() {
    if (!user) {
      requireLogin("Log in om een melding te krijgen wanneer er nieuwe wagens binnenkomen die bij je zoekopdracht passen.");
      return;
    }
    setState("idle");
    setError(null);
    setOpen(true);
  }

  async function save() {
    const sb = getSupabase();
    if (!sb || !user) return;
    setState("saving");
    const { error } = await sb.from("alerts").insert({ user_id: user.id, criteria: pickCriteria(criteria), frequency });
    if (error) {
      setState("idle");
      setError("Opslaan lukte niet. Probeer het opnieuw.");
    } else {
      setState("saved");
    }
  }

  return (
    <>
      <button
        onClick={start}
        className={
          variant === "solid"
            ? "rounded-full bg-ink px-6 py-3.5 text-[14.5px] text-white transition hover:bg-black"
            : "rounded-full border border-[#e3e3e3] bg-white px-[18px] py-2.5 text-[13.5px] whitespace-nowrap transition hover:border-ink"
        }
      >
        {label}
      </button>

      {open && (
        <Modal title={state === "saved" ? "Melding opgeslagen" : "Melding bij nieuwe wagens"} onClose={() => setOpen(false)}>
          {state === "saved" ? (
            <div className="space-y-4 text-sm">
              <p>
                Je krijgt {frequency === "daily" ? "elke ochtend" : "elke maandagochtend"} een mail als er nieuwe wagens
                binnenkomen voor <strong>{describe(criteria)}</strong>.
              </p>
              <div className="flex gap-2">
                <Link href="/meldingen" className="flex-1 rounded-md border border-line px-4 py-2.5 text-center font-medium">
                  Mijn meldingen
                </Link>
                <button onClick={() => setOpen(false)} className="flex-1 rounded-md bg-ink px-4 py-2.5 font-medium text-bg">
                  OK
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-1.5 text-sm font-medium">Je zoekopdracht</p>
                <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">{describe(criteria)}</p>
                <p className="mt-1.5 text-xs text-muted">
                  Tip: stel eerst je filters in (model, kleur, prijs, …) en bewaar dan de melding.
                </p>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Hoe vaak wil je een mail?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["daily", "Dagelijks", "Elke ochtend"],
                      ["weekly", "Wekelijks", "Elke maandag"],
                    ] as const
                  ).map(([value, label, sub]) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-xl border px-3.5 py-2.5 transition ${
                        frequency === value ? "border-ink ring-1 ring-ink" : "border-line hover:border-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="frequency"
                        value={value}
                        checked={frequency === value}
                        onChange={() => setFrequency(value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted">{sub}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-muted">Enkel als er nieuwe wagens zijn. Geen nieuwe wagens = geen mail.</p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                onClick={save}
                disabled={state === "saving"}
                className="w-full rounded-md bg-ink px-4 py-2.5 font-medium text-bg disabled:opacity-50"
              >
                {state === "saving" ? "Opslaan…" : "Melding opslaan"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
