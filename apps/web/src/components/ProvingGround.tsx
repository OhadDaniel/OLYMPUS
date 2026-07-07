import { useCallback, useEffect, useState } from "react";
import { fetchEvals, type Scorecard } from "../lib/insight.js";

export function ProvingGround() {
  const [card, setCard] = useState<Scorecard | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      setCard(await fetchEvals());
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg uppercase tracking-[0.25em] text-gold">The Proving Ground</h2>
        <button
          onClick={() => void run()}
          disabled={running}
          className="rounded-lg border border-gold/40 px-4 py-1.5 font-label text-xs uppercase tracking-widest text-gold hover:bg-gold/10 disabled:opacity-40"
        >
          {running ? "running…" : "run evals"}
        </button>
      </div>
      <p className="text-sm text-ink-3">
        Maxwell grades itself every commit: a regression gate over the safety gate, the scheduler's invariants,
        injection resistance, and whether the council's plans are actually executable.
      </p>

      {!card ? (
        <div className="text-ink-3">Running the suite…</div>
      ) : (
        <>
          <div
            className="rounded-xl border p-6 text-center"
            style={{ borderColor: card.overallPct === 100 ? "#4F8C82" : "#C6A15B", background: card.overallPct === 100 ? "rgba(79,140,130,0.08)" : "rgba(198,161,91,0.06)" }}
          >
            <div className="font-display text-5xl" style={{ color: card.overallPct === 100 ? "#6cc0b3" : "#C6A15B" }}>
              {card.overallPct}%
            </div>
            <div className="font-label text-xs uppercase tracking-widest text-ink-3">
              {card.overallPassed}/{card.overallTotal} checks passing · regression gate {card.overallPct >= 90 ? "✓ open" : "✗ blocked"}
            </div>
          </div>

          <div className="space-y-3">
            {card.suites.map((s) => (
              <div key={s.suite} className="rounded-lg border border-hairline bg-s1 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-label uppercase tracking-widest" style={{ color: s.pct === 100 ? "#6cc0b3" : "#c96b6b" }}>
                    {s.pct === 100 ? "✓" : "✗"} {s.suite}
                  </span>
                  <span className="text-xs text-ink-3">{s.passed}/{s.total}</span>
                </div>
                <p className="mb-2 text-xs text-ink-3">{s.description}</p>
                <div className="h-1.5 rounded bg-s2">
                  <div className="h-1.5 rounded" style={{ width: `${s.pct}%`, background: s.pct === 100 ? "#4F8C82" : "#c96b6b" }} />
                </div>
                {s.cases.filter((c) => !c.passed).length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-300">
                    {s.cases.filter((c) => !c.passed).map((c, i) => (
                      <li key={i}>✗ {c.name}{c.detail ? ` — ${c.detail}` : ""}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
