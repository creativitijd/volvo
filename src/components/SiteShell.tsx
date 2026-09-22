import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "./AccountMenu";
import { CountrySwitch } from "./CountrySwitch";
import { SiteMenu } from "./SiteMenu";

export function SiteShell({ children, hero }: { children: ReactNode; hero?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-6 px-5 pt-6 pb-5 sm:px-7">
        <div className="min-w-0">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="" className="h-[52px] w-[58px] object-contain" />
            <span className="text-[17px] font-semibold tracking-tight">Vind een Volvo</span>
          </Link>
          {hero}
        </div>
        <div className="flex items-center gap-2">
          <div className="max-md:hidden">
            <CountrySwitch />
          </div>
          <div className="max-md:hidden">
            <AccountMenu />
          </div>
          <SiteMenu />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 pb-6 sm:px-7">{children}</main>

      <footer className="mx-auto max-w-[1400px] px-5 pt-8 pb-16 sm:px-7">
        <p className="max-w-[740px] text-[12.5px] leading-relaxed text-[#9a9a9a]">
          Vind een Volvo is gratis en onafhankelijk — niet verbonden met, goedgekeurd door of gesponsord door Volvo
          Cars. De wagens komen uit publieke stocklijsten en advertenties. Gegevens kunnen wijzigen: controleer prijs
          en beschikbaarheid altijd bij de verkoper.
        </p>
      </footer>
    </div>
  );
}
