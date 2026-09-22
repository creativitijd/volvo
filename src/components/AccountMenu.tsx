"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";

export function AccountMenu() {
  const { user, ready, isAdmin, favorites, requireLogin, signOut } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (!ready) return <div className="h-9 w-24" />;

  if (!user) {
    return (
      <button
        onClick={() => requireLogin()}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-white transition hover:bg-black"
      >
        <UserIcon />
        Inloggen
      </button>
    );
  }

  const initial = (user.email ?? "?")[0].toUpperCase();
  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1">
        <Link
          href="/favorieten"
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm hover:bg-[#f2f2f2]"
          aria-label={`Mijn favorieten (${favorites.size})`}
        >
          <HeartIcon filled={favorites.size > 0} />
          <span className="tabular-nums">{favorites.size}</span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Accountmenu"
          className="grid size-[42px] place-items-center rounded-full bg-ink text-sm font-semibold text-white"
        >
          {initial}
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-2xl border border-line bg-surface p-2 text-sm shadow-xl">
          <p className="truncate px-3 py-2 text-muted">{user.email}</p>
          <MenuLink href="/favorieten" onClick={() => setOpen(false)}>
            Mijn favorieten
          </MenuLink>
          <MenuLink href="/meldingen" onClick={() => setOpen(false)}>
            Mijn meldingen
          </MenuLink>
          <MenuLink href="/mijn-advertenties" onClick={() => setOpen(false)}>
            Mijn advertenties
          </MenuLink>
          {isAdmin && (
            <MenuLink href="/beheer" onClick={() => setOpen(false)}>
              Beheer
            </MenuLink>
          )}
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
          >
            Uitloggen
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="block rounded-lg px-3 py-2 hover:bg-surface-2">
      {children}
    </Link>
  );
}

function UserIcon() {
  return (
    <svg className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="10" cy="7" r="3" />
      <path d="M4.5 16.5a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon({ filled, className = "size-4" }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path
        d="M10 17s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 6.2a3.6 3.6 0 0 1 6.5 2.2C16.5 13.1 10 17 10 17Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
