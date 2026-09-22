import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { Moderation } from "@/components/Moderation";

export const metadata: Metadata = { title: "Beheer | Vind een Volvo", robots: { index: false } };

export default function AdminPage() {
  return (
    <SiteShell>
      <h1 className="pb-6 pt-6 text-4xl font-medium tracking-tight">Advertenties nakijken</h1>
      <Moderation />
    </SiteShell>
  );
}
