"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Dropdown({
  label,
  count,
  hideCount,
  children,
}: {
  label: string;
  count: number;
  hideCount?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition ${
          count ? "border-ink bg-surface font-medium" : "border-line bg-surface hover:border-muted"
        }`}
      >
        {label}
        {count > 0 && !hideCount && (
          <span className="grid size-[18px] place-items-center rounded-full bg-ink text-[11px] text-bg">{count}</span>
        )}
        <svg className={`size-3 text-muted transition ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-line bg-surface p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:mt-2 sm:w-72 sm:shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

export function CheckList({
  options,
  selected,
  onChange,
  render = (v) => v,
}: {
  options: [string, number][];
  selected: string[];
  onChange: (v: string[]) => void;
  render?: (v: string) => string;
}) {
  if (!options.length) return <p className="px-3 py-2 text-sm text-muted">Geen opties</p>;
  return (
    <div className="grid max-h-72 gap-0.5 overflow-y-auto">
      {options.map(([value, n]) => {
        const on = selected.includes(value);
        return (
          <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">
            <input
              type="checkbox"
              checked={on}
              onChange={() => onChange(on ? selected.filter((x) => x !== value) : [...selected, value])}
              className="size-4 accent-[var(--ink)]"
            />
            <span className="flex-1">{render(value)}</span>
            <span className="text-muted">{n}</span>
          </label>
        );
      })}
    </div>
  );
}
