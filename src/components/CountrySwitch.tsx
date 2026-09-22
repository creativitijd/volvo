"use client";

import { useEffect, useState } from "react";

/** België / Nederland. Gewone links (volledige navigatie), zodat de zoekpagina de filters opnieuw inleest. */
export function CountrySwitch({ equal = false }: { equal?: boolean }) {
  const [country, setCountry] = useState<"BE" | "NL">("BE");
  useEffect(() => {
    const read = () =>
      setCountry(new URLSearchParams(window.location.search).get("land")?.toLowerCase() === "nl" ? "NL" : "BE");
    const t = setTimeout(read, 0);
    return () => clearTimeout(t);
  }, []);

  const item = (c: "BE" | "NL", label: string, href: string) => (
    <a
      href={href}
      aria-current={country === c ? "true" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full transition ${
        equal ? "flex-1 justify-center px-2 py-2" : "px-4 py-2"
      } ${country === c ? "bg-white text-ink" : "text-[#787878] hover:text-ink"}`}
    >
      {c === "BE" ? <BelgiumFlag /> : <NetherlandsFlag />}
      {label}
    </a>
  );

  return (
    <nav className={`flex rounded-full bg-[#f2f2f2] p-1 text-[13px] ${equal ? "w-full" : ""}`} aria-label="Land">
      {item("BE", "België", "/")}
      {item("NL", "Nederland", "/?land=nl")}
    </nav>
  );
}

function BelgiumFlag() {
  return (
    <svg viewBox="0 0 18 12" className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15" aria-hidden>
      <rect width="6" height="12" fill="#201c1c" />
      <rect x="6" width="6" height="12" fill="#f5d547" />
      <rect x="12" width="6" height="12" fill="#d8232a" />
    </svg>
  );
}

function NetherlandsFlag() {
  return (
    <svg viewBox="0 0 18 12" className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15" aria-hidden>
      <rect width="18" height="4" fill="#ae1c28" />
      <rect y="4" width="18" height="4" fill="#fff" />
      <rect y="8" width="18" height="4" fill="#21468b" />
    </svg>
  );
}
