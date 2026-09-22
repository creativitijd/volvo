"use client";

import { useState } from "react";

/** Telefoonnummer pas tonen na een klik: maakt het minder makkelijk om nummers massaal te verzamelen. */
export function PhoneReveal({ phone }: { phone: string }) {
  const [shown, setShown] = useState(false);
  const tel = phone.replace(/[^\d+]/g, "");
  return shown ? (
    <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-bg">
      <PhoneIcon /> {phone}
    </a>
  ) : (
    <button onClick={() => setShown(true)} className="flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 font-medium text-bg">
      <PhoneIcon /> Toon telefoonnummer
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 2.5h2.5l1.2 3-1.5 1a8 8 0 0 0 4.3 4.3l1-1.5 3 1.2V13a1 1 0 0 1-1 1A11.5 11.5 0 0 1 2 3.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}
