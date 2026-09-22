import { formatEuro } from "@/lib/format";

/** Trapgrafiek van de prijshistoriek (prijs blijft gelijk tot de volgende wijziging). */
export function PriceChart({ history, now }: { history: [number, number][]; now: number }) {
  const date = (t: number) => new Date(t).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
  // Zonder prijswijziging is een grafiek nietszeggend: gewoon de tekst
  if (history.length < 2) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
        Prijs ongewijzigd ({formatEuro(history[0][1])}) sinds {date(history[0][0])}. Daalt de prijs, dan zie je het hier.
      </p>
    );
  }
  const points = [...history, [now, history.at(-1)![1]] as [number, number]];
  const W = 600;
  const H = 160;
  const pad = { l: 8, r: 8, t: 16, b: 24 };
  const t0 = points[0][0];
  const t1 = Math.max(now, t0 + 86_400_000);
  const prices = points.map((p) => p[1]);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const span = hi - lo || hi * 0.05 || 1;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - (p - (lo - span * 0.25)) / (span * 1.5)) * (H - pad.t - pad.b);

  let d = `M${x(points[0][0])},${y(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += ` H${x(points[i][0])} V${y(points[i][1])}`;

  const changes = history.slice(1);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Prijsverloop">
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {history.map(([t, p]) => (
          <circle key={t} cx={x(t)} cy={y(p)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
        ))}
        <text x={pad.l} y={H - 6} fontSize="12" fill="var(--muted)">
          {date(t0)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="12" fill="var(--muted)" textAnchor="end">
          vandaag
        </text>
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        {changes.map(([t, p], i) => {
              const before = history[i][1];
              const delta = p - before;
              return (
                <span key={t} className="block">
                  {date(t)}: {formatEuro(before)} → {formatEuro(p)}{" "}
                  <span className={delta < 0 ? "font-medium text-save" : ""}>
                    ({delta < 0 ? "−" : "+"}
                    {formatEuro(Math.abs(delta))})
                  </span>
                </span>
              );
            })}
      </figcaption>
    </figure>
  );
}
