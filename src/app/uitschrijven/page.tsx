"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { SiteShell } from "@/components/SiteShell";

/** Eén-klik-uitschrijven vanuit de melding-mail (werkt zonder in te loggen). */
export default function Unsubscribe() {
  const [state, setState] = useState<"busy" | "done" | "unknown">("busy");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    const sb = getSupabase();
    if (!token || !sb) {
      const t = setTimeout(() => setState("unknown"), 0);
      return () => clearTimeout(t);
    }
    sb.rpc("unsubscribe_alert", { token }).then(({ data, error }) => setState(!error && data ? "done" : "unknown"));
  }, []);

  return (
    <SiteShell>
      <div className="mx-auto max-w-md py-24 text-center">
        {state === "busy" && <p className="text-muted">Even geduld…</p>}
        {state === "done" && (
          <>
            <h1 className="text-2xl font-medium">Je bent uitgeschreven</h1>
            <p className="mt-3 text-muted">Je krijgt geen mails meer voor deze melding.</p>
          </>
        )}
        {state === "unknown" && (
          <>
            <h1 className="text-2xl font-medium">Melding niet gevonden</h1>
            <p className="mt-3 text-muted">Misschien ben je al uitgeschreven. Je beheert al je meldingen via Mijn meldingen.</p>
          </>
        )}
        <Link href="/" className="mt-6 inline-block rounded-md bg-ink px-5 py-2.5 font-medium text-bg">
          Naar de wagens
        </Link>
      </div>
    </SiteShell>
  );
}
