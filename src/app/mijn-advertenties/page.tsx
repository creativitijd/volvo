import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { MyAds } from "@/components/MyAds";

export const metadata: Metadata = { title: "Mijn advertenties | Vind een Volvo" };

export default function MyAdsPage() {
  return (
    <SiteShell>
      <h1 className="pb-6 pt-6 text-4xl font-medium tracking-tight">Mijn advertenties</h1>
      <MyAds />
    </SiteShell>
  );
}
