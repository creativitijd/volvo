import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { AccountProvider } from "@/components/AccountProvider";

const sans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const serif = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: "Vind een Volvo | Stockwagens en tweedehands Volvo's in België en Nederland",
  description:
    "Nieuwe Volvo's op stock, gecertificeerde Volvo Selekt-occasions en particuliere Volvo's in België en Nederland op één plek. Dagelijks bijgewerkt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl-BE" className={`${sans.variable} ${serif.variable} antialiased`}>
      <body>
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
