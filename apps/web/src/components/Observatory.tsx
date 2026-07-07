import { useEffect, useState } from "react";
import { GODS } from "../../../../src/pantheon.js";
import { fetchObservatory, type Observatory as Data } from "../lib/insight.js";

function Radar({ data }: { data: Data["radar"] }) {
  const R = 90;
  const cx = 130;
  const cy = 120;
  const pts = (val: number) =>
    data
      .map((d, i) => {
        const a = (-90 + i * (360 / data.length)) * (Math.PI / 180);
        const r = ((val ? val : (d.baseline ?? 0)) / 10) * R;
        return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
      })
      .join(" ");
  const poly = (key: "baseline" | "current") =>
    data
      .map((d, i) => {
        const a = (-90 + i * (360 / data.length)) * (Math.PI / 180);
        const r = ((d[key] ?? 0) / 10) * R;
        return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
      })
      .join(" ");
  return (
    <svg viewBox="0 0 260 240" className="w-full max-w-sm">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={data
            .map((_, i) => {
              const a = (-90 + i * (360 / data.length)) * (Math.PI / 180);
              return `${cx + Math.cos(a) * R * f},${cy + Math.sin(a) * R * f}`;
            })
            .join(" ")}
          fill="none"
          stroke="#3A3542"
          strokeWidth="1"
        />
      ))}
      <polygon points={poly("baseline")} fill="none" stroke="#726C64" strokeWidth="1.5" strokeDasharray="4 3" />
      <polygon points={poly("current")} fill="rgba(198,161,91,0.15)" stroke="#C6A15B" strokeWidth="2" />
      {data.map((d, i) => {
        const a = (-90 + i * (360 / data.length)) * (Math.PI / 180);
        return (
          <text key={d.godId} x={cx + Math.cos(a) * (R + 22)} y={cy + Math.sin(a) * (R + 22)} fill={GODS[d.godId].accent} fontSize="10" textAnchor="middle">
            {GODS[d.godId].name}
          </text>
        );
      })}
    </svg>
  );
}

export function Observatory() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    void fetchObservatory().then(setData);
  }, []);
  if (!data) return <div className="p-8 text-center text-ink-3">Charting the sky…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 overflow-y-auto p-6">
      <h2 className="font-display text-lg uppercase tracking-[0.25em] text-gold">The Observatory</h2>

      {/* Week of stars */}
      <section>
        <p className="mb-2 font-label text-sm uppercase tracking-widest text-ink-2">Week of stars</p>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-s1 p-4">
          {data.stars.map((s) => (
            <div
              key={s.date}
              title={`${s.date}: ${s.executionPct}% (${s.count})`}
              className="rounded-full"
              style={{
                width: 6 + (s.executionPct / 100) * 16,
                height: 6 + (s.executionPct / 100) * 16,
                background: `rgba(232,200,126,${0.3 + (s.executionPct / 100) * 0.7})`,
                boxShadow: `0 0 ${s.executionPct / 8}px rgba(232,200,126,0.6)`,
              }}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Life-wheel radar */}
        <section>
          <p className="mb-2 font-label text-sm uppercase tracking-widest text-ink-2">Life wheel — baseline vs now</p>
          <Radar data={data.radar} />
        </section>

        {/* Per-god bars + candor */}
        <section className="space-y-4">
          <p className="font-label text-sm uppercase tracking-widest text-ink-2">Execution by god</p>
          {data.bars.map((b) => (
            <div key={b.godId}>
              <div className="mb-1 flex justify-between text-xs">
                <span style={{ color: GODS[b.godId].accent }}>{GODS[b.godId].name}</span>
                <span className="text-ink-3">{b.pct ?? "—"}% · {b.done}/{b.planned}</span>
              </div>
              <div className="h-2 rounded bg-s2">
                <div className="h-2 rounded" style={{ width: `${b.pct ?? 0}%`, background: GODS[b.godId].accent }} />
              </div>
            </div>
          ))}
          <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 p-4 text-center">
            <div className="font-display text-3xl text-gold">🔥 {data.candor.streak}</div>
            <div className="font-label text-xs uppercase tracking-widest text-ink-3">day candor streak · {data.candor.totalAnswers} honest answers</div>
          </div>
        </section>
      </div>
    </div>
  );
}
