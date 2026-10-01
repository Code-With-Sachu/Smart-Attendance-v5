"use client";
import * as React from "react";
import { formatDateShort } from "@/lib/utils";

/** Daily attendance-rate bars (single series) with hover/focus tooltips and an accessible table. */
export function TrendBars({ data }: { data: { date: string; rate: number }[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const H = 140;
  return (
    <figure className="relative">
      <div className="relative flex h-[164px] items-end gap-[2px] pl-8" onMouseLeave={() => setHover(null)}>
        {/* recessive gridlines at 0/50/100% */}
        {[100, 50, 0].map((g) => (
          <div key={g} className="pointer-events-none absolute left-8 right-0 border-t border-dashed border-border" style={{ bottom: (g / 100) * H + 24 }} aria-hidden>
            <span className="tabular absolute -left-8 -top-2 w-7 text-right text-[10px] text-fg-subtle">{g}%</span>
          </div>
        ))}
        {data.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className="group relative flex h-full flex-1 flex-col items-center justify-end pb-6 focus:outline-none"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${formatDateShort(d.date)}: ${d.rate}% attendance`}
          >
            <div
              className="w-full max-w-7 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring"
              style={{ height: Math.max(2, (d.rate / 100) * H), opacity: hover === null || hover === i ? 1 : 0.45 }}
            />
            <span className="tabular absolute bottom-0 text-[10px] text-fg-subtle">{d.date.slice(8)}</span>
          </button>
        ))}
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-pop"
            style={{
              left: `calc(2rem + (100% - 2rem) * ${(hover + 0.5) / data.length})`,
              bottom: (data[hover].rate / 100) * H + 32,
            }}
            role="status"
          >
            <div className="font-medium text-fg">{formatDateShort(data[hover].date)}</div>
            <div className="tabular text-fg-muted">{data[hover].rate}% present</div>
          </div>
        )}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Daily attendance rate</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row">{d.date}</th>
                <td>{d.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
