"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ITEMS = [
  ["/", "Bekijk alle auto's"],
  ["/modellen", "Alle modellen"],
  ["/over", "Over Vind een Volvo"],
  ["/verkopen", "Verkoop je Volvo"],
  ["/voorwaarden", "Gebruiksvoorwaarden"],
  ["/privacy", "Privacy en cookies"],
] as const;

export function SiteMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-[42px] place-items-center rounded-full border border-[#e3e3e3] bg-white hover:bg-[#f2f2f2]"
      >
        <svg className="text-ink" width="18" height="14" viewBox="0 0 18 14" fill="currentColor" aria-hidden>
          <rect width="18" height="2" y="0" rx="1" />
          <rect width="18" height="2" y="6" rx="1" />
          <rect width="18" height="2" y="12" rx="1" />
        </svg>
      </button>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-[rgba(23,26,24,0.34)] transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 flex w-[330px] max-w-[86vw] flex-col bg-white shadow-[-18px_0_44px_rgba(23,26,24,0.14)] transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-3.5">
          <div className="text-xs tracking-[0.08em] text-[#9a9a9a] uppercase">Menu</div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={() => setOpen(false)}
            className="grid size-[34px] place-items-center rounded-full border border-[#e9e9e9] text-[15px] text-[#3d3d3d] hover:bg-[#f2f2f2]"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col px-3.5 pb-6">
          {ITEMS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-3 py-4 text-base text-ink hover:bg-[#f6f6f6]"
            >
              <span>{label}</span>
              <span className="text-[13px] text-[#c4c4c4]">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
