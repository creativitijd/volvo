"use client";

import { useState } from "react";

export interface Place {
  lat: number;
  lon: number;
  label: string;
}

/** Locatie kiezen: via de browser, of via postcode als dat niet lukt/mag. */
export function LocationForm({ onFound, country = "BE" }: { onFound: (p: Place) => void; country?: "BE" | "NL" }) {
  const nl = country === "NL";
  const [pc, setPc] = useState("");
  const [busy, setBusy] = useState<"gps" | "pc" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useGps() {
    if (!navigator.geolocation) {
      setError("Je browser kan je locatie niet bepalen. Geef je postcode in.");
      return;
    }
    setBusy("gps");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        onFound({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "jouw locatie" });
      },
      (err) => {
        setBusy(null);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Je browser blokkeert je locatie. Geef je postcode in, of sta locatie toe in je browserinstellingen."
            : "Je locatie bepalen lukte niet. Geef je postcode in.",
        );
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pc");
    setError(null);
    try {
      const res = await fetch(`/api/postcode?pc=${encodeURIComponent(pc)}${nl ? "&land=nl" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onFound({ lat: data.lat, lon: data.lon, label: data.place });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Postcode opzoeken lukte niet.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2 p-1">
      <form onSubmit={lookup} className="flex gap-2">
        <input
          inputMode={nl ? "text" : "numeric"}
          autoComplete="postal-code"
          maxLength={nl ? 7 : 4}
          placeholder={nl ? "Postcode, bv. 3511 AB" : "Postcode, bv. 2000"}
          value={pc}
          onChange={(e) => setPc(nl ? e.target.value.toUpperCase().replace(/[^0-9A-Z ]/g, "") : e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
          aria-label="Postcode"
        />
        <button
          type="submit"
          disabled={(nl ? pc.replace(/\s/g, "").length < 4 : pc.length !== 4) || busy !== null}
          className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-bg disabled:opacity-40"
        >
          {busy === "pc" ? "…" : "OK"}
        </button>
      </form>
      <button
        type="button"
        onClick={useGps}
        disabled={busy !== null}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
      >
        <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" />
        </svg>
        {busy === "gps" ? "Locatie zoeken…" : "Gebruik mijn huidige locatie"}
      </button>
      {error && <p className="px-3 pb-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
