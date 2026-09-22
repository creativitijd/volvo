"use client";

import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";

function curvePath(counts: number[]) {
  const peak = Math.max(...counts, 1);
  const pts = counts.map(
    (v, i) => [(i / Math.max(counts.length - 1, 1)) * 100, 38 - (v / peak) * 34] as const,
  );
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function buckets(values: number[], min: number, max: number, n = 20) {
  const counts = Array.from({ length: n }, () => 0);
  const span = max - min || 1;
  for (const v of values) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(((v - min) / span) * n)));
    counts[i]++;
  }
  return counts;
}

export function DistributionRange({
  min,
  max,
  step,
  low,
  high,
  values,
  ticks,
  presets,
  labelMin,
  labelMax,
  onChange,
  formatTick,
}: {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  values: number[];
  ticks: number[];
  presets: { label: string; low: number; high: number }[];
  labelMin: string;
  labelMax: string;
  onChange: (low: number, high: number) => void;
  formatTick: (v: number) => string;
}) {
  const clipId = useId().replace(/:/g, "");
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<"min" | "max" | null>(null);
  const state = useRef({ low, high, min, max, step, onChange });
  state.current = { low, high, min, max, step, onChange };

  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;

  function snap(clientX: number) {
    const el = track.current;
    const s = state.current;
    if (!el) return s.low;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round((s.min + t * (s.max - s.min)) / s.step) * s.step;
  }

  function apply(which: "min" | "max", v: number) {
    const s = state.current;
    if (which === "min") s.onChange(Math.min(v, s.high - s.step), s.high);
    else s.onChange(s.low, Math.max(v, s.low + s.step));
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      apply(drag.current, snap(e.clientX));
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const d = curvePath(buckets(values, min, max));
  const x = pct(low);
  const w = Math.max(0, pct(high) - x);

  return (
    <div className="flex flex-col gap-2 md:gap-4">
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Bound label="Van" value={labelMin} />
        <div className="hidden h-px w-3.5 bg-[#d5d5d5] md:block" />
        <Bound label="Tot" value={labelMax} />
        <div className="hidden flex-1 md:block" />
        <div className="flex w-full gap-1.5 overflow-x-auto md:w-auto md:flex-wrap md:overflow-visible">
          {presets.map((p) => {
            const on = low === p.low && high === p.high;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.low, p.high)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] md:px-3 md:py-1.5 md:text-xs ${
                  on ? "border-ink bg-ink text-white" : "border-[#e3e3e3] bg-white text-[#3d3d3d]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="select-none">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-11 w-full overflow-visible md:h-[72px]">
          <defs>
            <clipPath id={clipId}>
              <rect x={x} y={-4} width={w} height={48} />
            </clipPath>
          </defs>
          <path d={d} fill="none" stroke="#e0e0e0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="#f5d547" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId})`} />
        </svg>
        <div className="mt-1 flex justify-between">
          {ticks.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(Math.min(t, high - step), high)}
              className={`text-[11px] ${t >= low && t <= high ? "text-ink" : "text-[#b0b0b0]"}`}
            >
              {formatTick(t)}
            </button>
          ))}
        </div>
        <div
          ref={track}
          className="relative mt-1.5 h-[26px] cursor-pointer"
          onPointerDown={(e) => {
            const v = snap(e.clientX);
            const nearMin = Math.abs(v - low) <= Math.abs(v - high);
            drag.current = nearMin ? "min" : "max";
            apply(drag.current, v);
          }}
        >
          <div className="absolute inset-x-0 top-[11px] h-1 rounded-sm bg-[#e6e6e6]" />
          <div className="absolute top-[11px] h-1 rounded-sm bg-ink" style={{ left: `${x}%`, right: `${100 - pct(high)}%` }} />
          <Handle
            left={x}
            onDown={(e) => {
              e.stopPropagation();
              drag.current = "min";
            }}
          />
          <Handle
            left={pct(high)}
            onDown={(e) => {
              e.stopPropagation();
              drag.current = "max";
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Bound({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-[10px] border border-[#e3e3e3] bg-white px-2.5 py-1.5 md:w-[200px] md:flex-none md:px-3 md:py-2">
      <div className="text-[10px] tracking-[0.07em] text-[#a8a8a8] uppercase">{label}</div>
      <div className="truncate text-[13px] md:mt-0.5 md:text-base">{value}</div>
    </div>
  );
}

function Handle({ left, onDown }: { left: number; onDown: (e: ReactPointerEvent) => void }) {
  return (
    <div
      onPointerDown={onDown}
      className="absolute top-[3px] size-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-ink bg-white shadow-[0_2px_6px_rgba(23,26,24,0.2)]"
      style={{ left: `${left}%` }}
    />
  );
}
