import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchEvals, type Scorecard } from "../lib/insight.js";

/* ── arcade / hacker palette (on-brand dark) ───────────────────────── */
const VOID = "#0B0A10";
const PANEL = "#15141B";
const GREEN = "#5FD3B0"; // bright terminal PASS
const GREEN_DIM = "#4F8C82"; // asclepius
const EMBER = "#E2823C"; // FAIL accent
const RED = "#c96b6b"; // failing console lines
const GOLD = "#C6A15B"; // accents
const IVORY = "#EDE6D6";
const DIM = "rgba(237,230,214,.42)";

type Tone = "dim" | "cmd" | "pass" | "fail" | "gold";
interface Line {
  text: string;
  tone: Tone;
}
const TONE: Record<Tone, string> = { dim: DIM, cmd: GOLD, pass: GREEN, fail: RED, gold: GOLD };

/* keyframes not in the global catalog — scoped by a pg* prefix */
const CSS = `
@keyframes pgBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes pgScan { 0%{transform:translateY(-30vh)} 100%{transform:translateY(130vh)} }
@keyframes pgGlow { 0%,100%{opacity:.5} 50%{opacity:1} }
`;

const BOOT: Line[] = [
  { text: "$ maxwell eval --suite=all --strict", tone: "cmd" },
  { text: "› spinning up regression harness…", tone: "dim" },
  { text: "› mounting suites…", tone: "dim" },
];

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
  const pass = open ? GREEN : EMBER;

  /* compile the real scorecard into a streaming test-runner log */
  const lines = useMemo<Line[]>(() => {
    if (!card) return [];
    const out: Line[] = [];
    out.push({ text: "$ maxwell eval --suite=all --strict", tone: "cmd" });
    out.push({ text: "› regression harness online — graded every commit, not asserted", tone: "dim" });
    const n = card.suites.length;
    card.suites.forEach((s, i) => {
      const idx = `${String(i + 1).padStart(2, "0")}/${String(n).padStart(2, "0")}`;
      out.push({ text: `▶ [${idx}] running suite: ${s.suite}`, tone: "gold" });
      if (s.pct === 100) {
        out.push({ text: `    ✓ ${s.passed}/${s.total} PASS · cleared`, tone: "pass" });
      } else {
        out.push({ text: `    ✗ ${s.passed}/${s.total} · ${s.total - s.passed} failing`, tone: "fail" });
        s.cases
          .filter((c) => !c.passed)
          .forEach((c) => out.push({ text: `        ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ""}`, tone: "fail" }));
      }
    });
    out.push({ text: "", tone: "dim" });
    out.push({ text: `Σ ${card.overallPassed}/${card.overallTotal} checks · ${card.overallPct}% integrity`, tone: "gold" });
    out.push({
      text: open ? "GATE OPEN — quality held ✓" : "GATE LOCKED — regression detected ✗",
      tone: open ? "pass" : "fail",
    });
    return out;
  }, [card, open]);

  /* stream the lines in like a live runner */
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (lines.length === 0) {
      setShown(0);
      return;
    }
    setShown(0);
    let n = 0;
    const t = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= lines.length) window.clearInterval(t);
    }, 80);
    return () => window.clearInterval(t);
  }, [lines]);

  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const streaming = card !== null && shown < lines.length;
  const display = card ? lines.slice(0, shown) : BOOT;

  return (
    <div className="relative min-h-screen overflow-hidden font-mono" style={{ background: VOID, color: IVORY }}>
      <style>{CSS}</style>

      {/* ── background texture: grid + scanlines + drifting sweep + grain ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(95,211,176,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(95,211,176,.035) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(120% 90% at 50% 0%, #000 40%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "repeating-linear-gradient(rgba(0,0,0,0) 0 2px, rgba(0,0,0,.28) 2px 3px)", opacity: 0.4, mixBlendMode: "multiply" }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{ height: 160, background: "linear-gradient(rgba(95,211,176,.06), transparent)", animation: "pgScan 7s linear infinite" }}
      />
      <div className="mx-grain" style={{ opacity: 0.05 }} />

      <div className="relative mx-auto max-w-[1220px] px-5 pb-24 pt-16 sm:px-8">
        {/* ── terminal window ─────────────────────────────────────────── */}
        <div style={{ border: `1px solid rgba(198,161,91,.28)`, background: "rgba(21,20,27,.72)", boxShadow: "0 40px 120px -50px rgba(0,0,0,.9)" }}>
          {/* title bar */}
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: `1px solid rgba(198,161,91,.2)`, background: "rgba(11,10,16,.6)" }}
          >
            <span style={{ display: "flex", gap: 6 }}>
              <i style={{ width: 10, height: 10, borderRadius: 999, background: EMBER, display: "block" }} />
              <i style={{ width: 10, height: 10, borderRadius: 999, background: GOLD, display: "block" }} />
              <i style={{ width: 10, height: 10, borderRadius: 999, background: GREEN, display: "block" }} />
            </span>
            <span className="text-[12px]" style={{ color: DIM }}>
              maxwell@olympus:<span style={{ color: GREEN_DIM }}>~/proving-ground</span>$ evals --watch
            </span>
            <span className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: DIM }}>
              <span style={{ color: streaming ? GREEN : GOLD }}>
                <span style={{ animation: "pgGlow 1.1s steps(1) infinite" }}>●</span> {streaming ? "LIVE" : "IDLE"}
              </span>
              <span>№ 09</span>
              {card && <span>{new Date(card.at).toLocaleTimeString()}</span>}
            </span>
          </div>

          {/* ── HUD strip: SCORE · health bar · GATE · RUN ─────────────── */}
          <div className="flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-center" style={{ borderBottom: `1px solid rgba(198,161,91,.14)` }}>
            {/* score */}
            <div className="shrink-0">
              <div className="text-[11px] tracking-[0.34em]" style={{ color: GOLD }}>
                SYSTEM INTEGRITY
              </div>
              <div className="flex items-end gap-1" style={{ lineHeight: 0.85 }}>
                <span
                  className="tabular-nums"
                  style={{ fontSize: 92, fontWeight: 600, color: card ? pass : DIM, textShadow: card ? `0 0 44px ${pass}55` : "none" }}
                >
                  {card ? card.overallPct : "--"}
                </span>
                <span className="mb-3 text-[26px]" style={{ color: card ? pass : DIM }}>
                  %
                </span>
              </div>
              <div className="text-[11px]" style={{ color: DIM }}>
                XP {card ? `${card.overallPassed}/${card.overallTotal}` : "0/0"} CHECKS
              </div>
            </div>

            {/* health / xp bar */}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-baseline justify-between text-[10px] tracking-[0.28em]" style={{ color: DIM }}>
                <span>HEALTH</span>
                <span style={{ color: GOLD }}>THRESHOLD 90</span>
              </div>
              <div className="relative h-4 w-full" style={{ background: "rgba(237,230,214,.06)", border: "1px solid rgba(237,230,214,.12)" }}>
                {/* segment ticks */}
                {[20, 40, 60, 80].map((p) => (
                  <span key={p} className="absolute top-0 bottom-0" style={{ left: `${p}%`, width: 1, background: "rgba(11,10,16,.7)" }} />
                ))}
                {/* gate threshold marker @90 */}
                <span className="absolute top-[-4px] bottom-[-4px]" style={{ left: "90%", width: 2, background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
                {/* fill */}
                {card && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${card.overallPct}%`,
                      background: `repeating-linear-gradient(90deg, ${pass} 0 6px, ${pass}bb 6px 8px)`,
                      boxShadow: `0 0 18px ${pass}88`,
                      transformOrigin: "left",
                      animation: "mxGrow 1s var(--ease) both",
                    }}
                  />
                )}
              </div>
            </div>

            {/* gate + run */}
            <div className="flex shrink-0 items-center gap-4">
              <div
                className="px-4 py-2 text-center text-[12px] tracking-[0.2em]"
                style={{
                  border: `1px solid ${card ? pass : "rgba(237,230,214,.2)"}`,
                  color: card ? pass : DIM,
                  background: card ? `${pass}12` : "transparent",
                  animation: card && !open ? "mxShimmer 1.1s ease-in-out infinite" : "none",
                }}
              >
                GATE: {card ? (open ? "OPEN ✓" : "LOCKED ✗") : "…"}
              </div>
              <button
                onClick={() => void run()}
                disabled={running}
                className="text-[13px] tracking-[0.22em] transition"
                style={{
                  color: running ? DIM : GREEN,
                  border: `1px solid ${running ? "rgba(237,230,214,.2)" : GREEN}`,
                  background: running ? "transparent" : `${GREEN}12`,
                  padding: "11px 20px",
                  cursor: running ? "default" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!running) e.currentTarget.style.boxShadow = `0 0 22px ${GREEN}66`;
                }}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                {running ? "◼ RECOMPILING…" : "▶ RUN EVALS"}
              </button>
            </div>
          </div>

          {/* ── body: live console + level board ──────────────────────── */}
          <div className="grid grid-cols-1 gap-px lg:grid-cols-[1.25fr_1fr]" style={{ background: "rgba(198,161,91,.14)" }}>
            {/* live console */}
            <div style={{ background: PANEL }}>
              <div className="flex items-center gap-2 px-5 py-2.5 text-[10px] tracking-[0.3em]" style={{ color: GOLD, borderBottom: "1px solid rgba(198,161,91,.12)" }}>
                <span>▏ TEST RUNNER — stdout</span>
              </div>
              <div ref={scroller} className="px-5 py-4 text-[12.5px]" style={{ height: 440, overflowY: "auto", lineHeight: 1.75 }}>
                {display.map((l, i) => (
                  <div
                    key={`${i}-${l.text}`}
                    style={{ color: TONE[l.tone], whiteSpace: "pre-wrap", animation: `mxRowIn .3s var(--ease) both` }}
                  >
                    {l.text === "" ? " " : l.text}
                  </div>
                ))}
                {/* prompt + blinking caret */}
                <div style={{ color: GREEN }}>
                  <span style={{ color: GOLD }}>maxwell:~$</span>{" "}
                  {streaming ? <span style={{ color: DIM }}>running…</span> : ""}
                  <span style={{ display: "inline-block", width: 9, height: 15, background: GREEN, marginLeft: 4, transform: "translateY(2px)", animation: "pgBlink 1s steps(1) infinite" }} />
                </div>
              </div>
            </div>

            {/* level board — suites as bosses */}
            <div style={{ background: PANEL }}>
              <div className="flex items-center px-5 py-2.5 text-[10px] tracking-[0.3em]" style={{ color: GOLD, borderBottom: "1px solid rgba(198,161,91,.12)" }}>
                <span>▏ LEVELS</span>
                <span className="ml-auto" style={{ color: DIM }}>
                  {card ? `${card.suites.filter((s) => s.pct === 100).length}/${card.suites.length} CLEARED` : ""}
                </span>
              </div>
              <div className="flex flex-col" style={{ maxHeight: 440, overflowY: "auto" }}>
                {(card?.suites ?? []).map((s, i) => {
                  const cleared = s.pct === 100;
                  const hue = cleared ? GREEN : EMBER;
                  const fails = s.cases.filter((c) => !c.passed);
                  return (
                    <div
                      key={s.suite}
                      className="px-5 py-4"
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid rgba(237,230,214,.07)",
                        borderLeft: `2px solid ${hue}`,
                        animation: `mxBlockIn .5s var(--ease) ${0.05 + i * 0.07}s both`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] tracking-[0.24em]" style={{ color: GOLD }}>
                          LVL {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[12.5px] uppercase tracking-[0.12em]" style={{ color: IVORY }}>
                          {s.suite.replace(/-/g, "_")}
                        </span>
                        <span className="ml-auto text-[10px] tracking-[0.18em]" style={{ color: hue }}>
                          {cleared ? "✓ CLEARED" : "✗ BREACHED"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px]" style={{ color: DIM, lineHeight: 1.5 }}>
                        {s.description}
                      </p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="h-[6px] flex-1" style={{ background: "rgba(237,230,214,.08)" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${s.pct}%`,
                              background: hue,
                              boxShadow: `0 0 10px ${hue}88`,
                              transformOrigin: "left",
                              animation: `mxGrow 1s var(--ease) ${0.15 + i * 0.07}s both`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums text-[11px]" style={{ color: hue }}>
                          {s.passed}/{s.total}
                        </span>
                      </div>
                      {fails.length > 0 && (
                        <div className="mt-2 flex flex-col gap-0.5">
                          {fails.map((c, j) => (
                            <span
                              key={j}
                              className="text-[10.5px]"
                              style={{ color: RED, animation: `mxRowIn .4s var(--ease) ${j * 0.05}s both` }}
                            >
                              ✗ {c.name}
                              {c.detail ? ` — ${c.detail}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!card && (
                  <div className="px-5 py-8 text-[11px]" style={{ color: DIM, animation: "pgGlow 1.2s ease-in-out infinite" }}>
                    ▏ awaiting first run…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* footer — terminal grammar */}
        {card && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-[11px]" style={{ color: DIM }}>
            <span>
              Σ {card.overallPassed}/{card.overallTotal} CHECKS
            </span>
            <span style={{ color: pass }}>
              · GATE {open ? "OPEN — QUALITY HELD" : "LOCKED — QUALITY DROPPED"}
            </span>
            <span className="ml-auto">compiled {new Date(card.at).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
