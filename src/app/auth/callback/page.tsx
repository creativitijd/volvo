"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { SiteShell } from "@/components/SiteShell";

/** Landingspagina van de inloglink. De Supabase-client wisselt de code uit de URL zelf in voor een sessie. */
export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (!sb) {
      router.replace("/");
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext);
      else setFailed(true);
    });
  }, [router]);

  return (
    <SiteShell>
      <div className="mx-auto max-w-md py-24 text-center">
        {failed ? (
          <>
            <h1 className="text-2xl font-medium">Deze inloglink werkt niet meer</h1>
            <p className="mt-3 text-muted">
              Links zijn maar kort geldig en werken enkel in de browser waarin je ze aanvroeg. Vraag een nieuwe aan.
            </p>
            <Link href="/" className="mt-6 inline-block rounded-md bg-ink px-5 py-2.5 font-medium text-bg">
              Terug naar de wagens
            </Link>
          </>
        ) : (
          <p className="text-muted">Bezig met inloggen…</p>
        )}
      </div>
    </SiteShell>
  );
}
