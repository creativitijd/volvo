"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/** Relatieve tijd die client-side bijwerkt (de pagina zelf is gecachet). */
export function UpdatedAgo({ at }: { at: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return (
    <time dateTime={new Date(at).toISOString()} suppressHydrationWarning>
      {now ? timeAgo(at, now) : new Date(at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}
