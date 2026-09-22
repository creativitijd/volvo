"use client";

import { useEffect, useState } from "react";

/** België / Nederland. Gewone links (volledige navigatie), zodat de zoekpagina de filters opnieuw inleest. */
export function CountrySwitch() {
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
      className={`rounded-full px-4 py-2 transition ${
        country === c ? "bg-white text-ink" : "text-[#787878] hover:text-ink"
      }`}
    >
      {label}
    </a>
  );

  return (
    <nav className="flex rounded-full bg-[#f2f2f2] p-1 text-[13px]" aria-label="Land">
      {item("BE", "België", "/")}
      {item("NL", "Nederland", "/?land=nl")}
    </nav>
  );
}
