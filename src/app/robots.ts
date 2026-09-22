import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Persoonlijke en interne pagina's horen niet in Google
      disallow: ["/api/", "/auth/", "/beheer", "/favorieten", "/meldingen", "/mijn-advertenties", "/uitschrijven"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
