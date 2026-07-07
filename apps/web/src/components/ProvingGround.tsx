import { useCallback, useEffect, useState } from "react";
import { fetchEvals, type Scorecard } from "../lib/insight.js";

const GOLD = "#C6A15B";
const EMBER = "#E2823C";
const IVORY = "#EDE6D6";

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

  const open = card ? card.overallPct >= 90 : false;

  return (
    <div className="relative min-h-screen overflow-hidden bg-void font-body text-marbleivory">
      {/* texture: rotating contours + gold nebula + grain */}
      <div className="mx-contours mx-contours-ivory" style={{ top: "-260px", right: "-200px", width: 1000, height: 1000, opacity: 0.14 }} />
      <div
        className="pointer-events-none absolute"
        style={{ left: "-10%", top: "20%", width: 700, height: 700, background: "radial-gradient(50% 50% at 50% 50%, rgba(198,161,91,.10), transparent 70%)" }}
      />
      <div className="mx-grain" style={{ opacity: 0.06 }} />

      <div className="relative mx-auto max-w-[1080px] px-12 py-16">
        {/* header */}
        <div className="flex items-baseline gap-4" style={{ animation: "mxRise 1s var(--ease) both" }}>
          <span className="font-label text-[12px] tracking-[0.4em]" style={{ color: GOLD }}>
            THE PROVING GROUND — № 09
          </span>
          <span className="ml-auto font-label text-[11px] tracking-[0.3em] text-mist">MAXWELL GRADES HIMSELF</span>
        </div>

        <div className="mt-6 flex items-end justify-between" style={{ animation: "mxRise 1.1s var(--ease) 0.1s both" }}>
          <div className="max-w-[560px]">
            <h1 className="font-display" style={{ fontWeight: 380, fontSize: 60, lineHeight: 1.02, letterSpacing: "-0.02em", color: IVORY }}>
              The week, put on trial
            </h1>
            <p className="mt-5 font-voice italic" style={{ fontSize: 19, lineHeight: 1.5, color: "rgba(237,230,214,.62)" }}>
              A regression gate over the safety gate, the scheduler's invariants, injection resistance, and whether the
              council's plans are truly executable — measured every commit, not asserted.
            </p>
          </div>
          {card && (
            <div className="text-right">
              <div
                className="font-display italic"
                style={{ fontWeight: 340, fontSize: 112, lineHeight: 0.9, color: GOLD, textShadow: "0 0 40px rgba(198,161,91,.4)" }}
              >
                {card.overallPct}
              </div>
              <div className="font-label text-[11px] tracking-[0.3em]" style={{ color: open ? GOLD : EMBER }}>
                REGRESSION GATE — {open ? "OPEN" : "BLOCKED"}
              </div>
            </div>
          )}
        </div>

        {/* run action */}
        <div className="mt-8">
          <button
            onClick={() => void run()}
            disabled={running}
            className="font-label text-[12px] uppercase tracking-[0.28em] transition"
            style={{ color: GOLD, border: `1px solid rgba(198,161,91,.45)`, background: "transparent", padding: "12px 26px", borderRadius: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(198,161,91,.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {running ? "WEIGHING…" : "ENGRAVE AGAIN —"}
          </button>
        </div>

        {/* suites — engraved rows */}
        <div className="mt-12 flex flex-col">
          {(card?.suites ?? []).map((s, i) => {
            const passed = s.pct === 100;
            const hue = passed ? GOLD : EMBER;
            return (
              <div
                key={s.suite}
                className="py-6"
                style={{ borderTop: "1px solid rgba(237,230,214,.14)", animation: `mxRise .8s var(--ease) ${0.15 + i * 0.08}s both` }}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-display italic" style={{ fontSize: 22, color: hue }}>
                    {passed ? "✦" : "▲"}
                  </span>
                  <span className="font-label text-[13px] uppercase tracking-[0.3em]" style={{ color: hue }}>
                    {s.suite.replace(/-/g, " ")}
                  </span>
                  <span className="ml-auto font-mono text-[12px]" style={{ color: "rgba(237,230,214,.6)" }}>
                    {s.passed}/{s.total}
                  </span>
                </div>
                <p className="mt-2 font-voice italic" style={{ fontSize: 16, color: "rgba(237,230,214,.55)" }}>
                  {s.description}
                </p>
                <div className="mt-3 h-[3px] w-full" style={{ background: "rgba(237,230,214,.1)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${s.pct}%`,
                      background: hue,
                      transformOrigin: "left",
                      animation: `mxGrow 1.1s var(--ease) ${0.3 + i * 0.08}s both`,
                    }}
                  />
                </div>
                {s.cases.filter((c) => !c.passed).length > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    {s.cases
                      .filter((c) => !c.passed)
                      .map((c, j) => (
                        <span key={j} className="font-mono text-[11px]" style={{ color: EMBER, animation: `mxRowIn .5s var(--ease) ${j * 0.06}s both` }}>
                          ✗ {c.name}
                          {c.detail ? ` — ${c.detail}` : ""}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* footer totals — terminal grammar */}
        {card && (
          <div
            className="mt-8 flex items-center gap-6 pt-6 font-mono text-[12px]"
            style={{ borderTop: "1px solid rgba(237,230,214,.14)", color: "rgba(237,230,214,.55)" }}
          >
            <span>Σ {card.overallPassed}/{card.overallTotal} CHECKS</span>
            <span style={{ color: open ? GOLD : EMBER }}>· GATE {open ? "OPEN — QUALITY HELD" : "BLOCKED — QUALITY DROPPED"}</span>
            <span className="ml-auto">{new Date(card.at).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
