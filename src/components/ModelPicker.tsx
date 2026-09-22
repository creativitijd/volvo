import type { ModelSummary } from "@/lib/card";

const SERIES_RANK: Record<string, number> = { C: 0, V: 1, S: 2, XC: 3, EC: 4, ES: 5, EX: 6 };

export function modelIconSrc(model: string) {
  const slug =
    model === "V40 Cross Country"
      ? "v40cc"
      : model === "V60 Cross Country"
        ? "v60cc"
        : model === "V90 Cross Country"
          ? "v90cc"
          : model.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `/models/icon-${slug}.png`;
}

export function sortModels<T extends { model: string }>(models: T[]) {
  const num = (m: string) => Number(m.match(/\d+/)?.[0] ?? 0);
  const prefix = (m: string) => SERIES_RANK[m.match(/^[A-Z]+/)?.[0] ?? ""] ?? 9;
  return [...models].sort(
    (a, b) => num(a.model) - num(b.model) || prefix(a.model) - prefix(b.model) || a.model.localeCompare(b.model, "nl"),
  );
}

export function ModelPicker({
  models,
  selected,
  onSelect,
}: {
  models: ModelSummary[];
  selected: string | null;
  onSelect: (model: string | null) => void;
}) {
  const sorted = sortModels(models);
  return (
    <div className="grid grid-cols-4 gap-1.5 md:grid-cols-6 md:gap-2 lg:grid-cols-9">
      {sorted.map((m) => {
        const active = selected === m.model;
        return (
          <button
            key={m.model}
            type="button"
            onClick={() => onSelect(active ? null : m.model)}
            aria-pressed={active}
            className={`overflow-hidden rounded-xl border bg-white text-left transition ${
              active ? "border-ink shadow-[0_0_0_1px_#171a18]" : "border-[#ececeb] hover:border-[#cfcfcf]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={modelIconSrc(m.model)} alt="" className="mx-auto mt-1 h-11 w-[78%] object-contain md:mt-2 md:h-[78px]" />
            <div className="flex flex-col items-center gap-0.5 px-1 pt-0.5 pb-1.5 md:flex-row md:justify-between md:gap-1.5 md:px-2.5 md:pt-1 md:pb-2.5">
              <span className="text-center text-[12px] leading-tight font-semibold md:truncate md:text-left md:text-[13.5px]">
                {m.model.replace(" Cross Country", " CC")}
              </span>
              <span className="shrink-0 rounded-full bg-mark px-1.5 py-0.5 text-[10px] font-medium text-ink md:text-[11px]">{m.count}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
