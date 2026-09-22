"use client";

import { useState, type ReactNode } from "react";

export function Gallery({
  images,
  alt,
  studio = false,
  badge,
}: {
  images: string[];
  alt: string;
  studio?: boolean;
  badge?: ReactNode;
}) {
  // Studiofoto's (nieuwe wagens) volledig tonen; echte foto's (tweedehands) mogen bijgesneden worden
  const fit = studio ? "object-contain" : "object-cover";
  const aspect = studio ? "aspect-[16/9]" : "aspect-[4/3]";
  const [i, setI] = useState(0);
  if (!images.length) return <div className={`${aspect} rounded-[18px] bg-[#ededed]`} />;
  const go = (d: number) => setI((n) => (n + d + images.length) % images.length);
  return (
    <div className="grid gap-2.5">
      <div className={`relative ${aspect} overflow-hidden rounded-[18px] bg-[#ededed]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={alt} className={`size-full ${fit}`} />
        {badge && <div className="absolute bottom-3 left-3">{badge}</div>}
        {images.length > 1 && (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
            <span className="absolute right-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-white tabular-nums">
              {i + 1}/{images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, n) => (
            <button
              key={src}
              onClick={() => setI(n)}
              aria-label={`Foto ${n + 1}`}
              className={`${aspect} w-24 shrink-0 overflow-hidden rounded-xl bg-[#ededed] ${n === i ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className={`size-full ${fit}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Vorige foto" : "Volgende foto"}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_2px_8px_rgba(23,26,24,0.16)] ${side === "left" ? "left-3" : "right-3"}`}
    >
      <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d={side === "left" ? "M10 3 5 8l5 5" : "m6 3 5 5-5 5"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
