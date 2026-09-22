import type { ReactNode } from "react";

/** Eenvoudige opmaak voor tekstpagina's (over, voorwaarden, privacy, gidsen) */
export function Prose({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl pb-8 pt-6">
      <h1 className="text-4xl font-medium tracking-tight">{title}</h1>
      {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
      <div className="mt-8 space-y-4 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}
