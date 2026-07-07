import { useEffect, useState } from "react";
import type { GodId } from "../../../../src/types.js";
import { GODS_DESIGN, roman, tint } from "../lib/design.js";
import { fetchObservatory, type Observatory as ObsData } from "../lib/insight.js";

/* ------------------------------------------------------------------ */
/*  The Observatory — the week read as stars. Sacred dark.            */
/*  Faithful port of screens/The Observatory.dc.html, wired to live   */
/*  fetchObservatory() data.                                          */
/* ------------------------------------------------------------------ */

const INK = "#EDE6D6";
const GOLD = "#C6A15B";
const GOLD_LIGHT = "#E8C87E";
const PANEL = "#15141B";
const EASE = "cubic-bezier(.22,1,.36,1)";

// Local fade keyframe — mxFadeIn is not in the global catalog.
const FADE_KEYFRAMES = "@keyframes mxObsFade{from{opacity:0}to{opacity:1}}";

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(s: string): Date {
  return new Date(`${s}T00:00:00`);
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** ISO week number — cosmetic, feeds the "Week XXVIII" numeral. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/* --------------------------- constellation ------------------------ */

function Constellation({ stars, delayBase }: { stars: ObsData["stars"]; delayBase: number }) {
  const todayIso = isoOf(new Date());
  const N = stars.length;
  const xFor = (i: number) => (N <= 1 ? 500 : 60 + (i / (N - 1)) * (940 - 60));
  const yFor = (pct: number) => 50 + (1 - Math.min(100, Math.max(0, pct)) / 100) * 95;

  type Node = { i: number; x: number; y: number; pct: number; core: number; future: boolean; today: boolean; label: string };
  const nodes: Node[] = stars.map((s, i) => {
    const future = s.date > todayIso;
    const today = s.date === todayIso;
    const pct = s.executionPct;
    const base = WD[parseDay(s.date).getDay()] ?? "";
    const label = future ? `${base} — UNWRITTEN` : today ? `${base} — TODAY` : base;
    return {
      i,
      x: xFor(i),
      y: future ? 120 : yFor(pct),
      pct,
      core: 5.5 + (pct / 100) * 5.5,
      future,
      today,
      label,
    };
  });

  const written = nodes.filter((n) => !n.future);
  const firstFuture = nodes.find((n) => n.future);
  const lastWritten = written[written.length - 1];
  const polyPts = written.map((n) => `${n.x.toFixed(0)},${n.y.toFixed(0)}`).join(" ");

  return (
    <svg width="100%" viewBox="0 0 1000 252" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <filter id="obsGlow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* horizon grid */}
      {[40, 120, 200].map((y) => (
        <line key={y} x1="30" y1={y} x2="970" y2={y} stroke={tint("237,230,214", 0.06)} strokeWidth="1" />
      ))}

      {/* the drawn line through the written days */}
      {written.length >= 2 && (
        <polyline
          points={polyPts}
          fill="none"
          stroke={tint("232,200,126", 0.45)}
          strokeWidth="1"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
          style={{ animation: `mxDraw 2.6s ${EASE} ${delayBase + 0.5}s forwards` }}
        />
      )}
      {/* dashed reach toward the unwritten */}
      {lastWritten && firstFuture && (
        <line
          x1={lastWritten.x}
          y1={lastWritten.y}
          x2={firstFuture.x}
          y2={firstFuture.y}
          stroke={tint("237,230,214", 0.22)}
          strokeWidth="1"
          strokeDasharray="3 6"
        />
      )}

      {nodes.map((n, idx) => {
        const twinkleDur = 5 + (idx % 5) * 0.5;
        const labelFill = n.today ? GOLD : tint("237,230,214", n.future ? 0.4 : 0.5);
        return (
          <g key={n.i} style={{ opacity: 0, animation: `mxObsFade 1.1s ease ${delayBase + 0.6 + idx * 0.12}s forwards` }}>
            {n.future ? (
              <circle cx={n.x} cy={n.y} r={7.5} fill="none" stroke={tint("237,230,214", 0.45)} strokeWidth="1" strokeDasharray="2 3" />
            ) : (
              <>
                <circle cx={n.x} cy={n.y} r={n.core * 2.2} fill={GOLD_LIGHT} opacity={0.12 + (n.pct / 100) * 0.24} filter="url(#obsGlow)" />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.core}
                  fill={n.pct < 50 ? tint("232,200,126", 0.55) : GOLD_LIGHT}
                  style={{ animation: `mxTwinkle ${twinkleDur}s ease-in-out infinite` }}
                />
              </>
            )}
            {/* drop line to the label rail */}
            <line
              x1={n.x}
              y1={n.y + n.core + 6}
              x2={n.x}
              y2={212}
              stroke={tint("237,230,214", n.future ? 0.12 : 0.16)}
              strokeWidth="1"
              strokeDasharray="2 5"
            />
            {/* score */}
            <text
              x={n.x + 16}
              y={n.y - 5}
              fill={n.future ? tint("237,230,214", 0.4) : tint("237,230,214", n.pct < 50 ? 0.6 : 1)}
              style={{ fontFamily: "'Fraunces',Georgia,serif", fontStyle: "italic", fontSize: 19 }}
            >
              {n.future ? "—" : n.pct}
            </text>
            {/* day label */}
            <text
              x={n.x}
              y={238}
              textAnchor="middle"
              fill={labelFill}
              style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: "0.26em" }}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------ radar ----------------------------- */

function LifeWheel({ radar, delayBase }: { radar: ObsData["radar"]; delayBase: number }) {
  const cx = 150;
  const cy = 150;
  const maxR = 92;
  const n = radar.length;
  const angle = (i: number) => (-90 + (i * 360) / n) * (Math.PI / 180);
  const pt = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r] as const;
  const ringPts = (f: number) =>
    radar.map((_, i) => pt(i, maxR * f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const valPts = (key: "baseline" | "current") =>
    radar
      .map((d, i) => {
        const v = (d[key] ?? 0) / 10;
        return pt(i, maxR * Math.min(1, Math.max(0, v))).map((x) => x.toFixed(1)).join(",");
      })
      .join(" ");

  return (
    <svg width="330" height="316" viewBox="0 0 300 290">
      {/* concentric rings */}
      {[1, 0.66, 0.35].map((f, k) => (
        <polygon key={f} points={ringPts(f)} fill="none" stroke={tint("237,230,214", 0.12 - k * 0.02)} strokeWidth="1" />
      ))}
      {/* spokes, each in its god's hue */}
      {radar.map((d, i) => {
        const [x, y] = pt(i, maxR);
        const g = GODS_DESIGN[d.godId];
        return <line key={`sp-${d.godId}`} x1={cx} y1={cy} x2={x} y2={y} stroke={tint(g.rgb, 0.4)} strokeWidth="1" />;
      })}
      {/* baseline — the first meeting */}
      <polygon
        points={valPts("baseline")}
        fill="none"
        stroke={tint("237,230,214", 0.38)}
        strokeWidth="1"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: `mxDraw 2.2s ${EASE} ${delayBase + 0.4}s forwards` }}
      />
      {/* now — filled */}
      <polygon
        points={valPts("current")}
        fill={tint("198,161,91", 0.12)}
        stroke="none"
        style={{ opacity: 0, animation: `mxObsFade 1.6s ease ${delayBase + 2.3}s forwards` }}
      />
      <polygon
        points={valPts("current")}
        fill="none"
        stroke={GOLD}
        strokeWidth="1.6"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: `mxDraw 2.4s ${EASE} ${delayBase + 1.1}s forwards` }}
      />
      {/* vertices in god hues */}
      <g style={{ opacity: 0, animation: `mxObsFade 1.4s ease ${delayBase + 2.8}s forwards` }}>
        {radar.map((d, i) => {
          const v = Math.min(1, Math.max(0, (d.current ?? 0) / 10));
          const [x, y] = pt(i, maxR * v);
          return <circle key={`v-${d.godId}`} cx={x} cy={y} r={3.4} fill={GODS_DESIGN[d.godId].hue} />;
        })}
      </g>
      {/* axis labels */}
      {radar.map((d, i) => {
        const [x, y] = pt(i, maxR + 16);
        const g = GODS_DESIGN[d.godId];
        return (
          <text
            key={`l-${d.godId}`}
            x={x}
            y={y + 3}
            textAnchor="middle"
            fill={g.hue}
            style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: "0.2em" }}
          >
            {d.title.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------ screen ---------------------------- */

export function Observatory({ onReturn }: { onReturn?: () => void }) {
  const [data, setData] = useState<ObsData | null>(null);

  useEffect(() => {
    void fetchObservatory().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0B0A10",
          color: tint("237,230,214", 0.55),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontStyle: "italic",
          fontSize: 18,
        }}
      >
        Charting the sky…
      </div>
    );
  }

  const now = new Date();
  const weekNum = roman(isoWeek(now));
  const written = data.stars.filter((s) => s.date <= isoOf(now));
  const weekScore =
    written.length > 0 ? Math.round(written.reduce((a, s) => a + s.executionPct, 0) / written.length) : 0;

  let range = "the week, read as stars";
  if (data.stars.length > 0) {
    const a = parseDay(data.stars[0].date);
    const b = parseDay(data.stars[data.stars.length - 1].date);
    const dd = (d: Date) => String(d.getDate()).padStart(2, "0");
    range =
      a.getMonth() === b.getMonth()
        ? `${MON[a.getMonth()]} ${dd(a)} — ${dd(b)} · no confetti, only sky`
        : `${MON[a.getMonth()]} ${dd(a)} — ${MON[b.getMonth()]} ${dd(b)} · no confetti, only sky`;
  }

  const godName = (id: GodId) => GODS_DESIGN[id].name;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#0B0A10", overflow: "hidden", paddingBottom: 70 }}>
      <style>{FADE_KEYFRAMES}</style>

      {/* atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url('/assets/stars-near.svg')",
          backgroundSize: "900px 600px",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -380,
          right: -320,
          width: 1200,
          height: 1200,
          background: "url('/assets/contours-ivory.svg') center / contain no-repeat",
          opacity: 0.13,
          animation: "mxSpin 400s linear infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -160,
          left: -220,
          width: 760,
          height: 560,
          background: "radial-gradient(50% 50% at 50% 50%, rgba(198,161,91,.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 110,
          left: -150,
          width: 150,
          height: 1,
          background: "linear-gradient(90deg, transparent, #E8C87E, transparent)",
          opacity: 0,
          animation: "mxShoot 13s linear 3s infinite",
          pointerEvents: "none",
        }}
      />

      {/* header */}
      <div
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "44px 48px 8px",
          display: "flex",
          alignItems: "flex-end",
          gap: 36,
          animation: `mxRise 1.1s ${EASE} .2s both`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: "0.44em", color: GOLD }}>
            THE OBSERVATORY
          </span>
          <h1 style={{ margin: 0, fontFamily: "'Fraunces',Georgia,serif", fontWeight: 330, fontSize: 56, lineHeight: 1, color: INK }}>
            Week {weekNum}, read as stars
          </h1>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 30 }}>
          <span
            style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: "italic",
              fontSize: 17,
              color: tint("237,230,214", 0.55),
              paddingBottom: 14,
            }}
          >
            {range}
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span
              style={{
                fontFamily: "'Fraunces',Georgia,serif",
                fontStyle: "italic",
                fontWeight: 320,
                fontSize: 106,
                lineHeight: 0.82,
                color: GOLD,
                textShadow: "0 0 46px rgba(198,161,91,.4)",
              }}
            >
              {weekScore}
            </span>
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: "0.34em", color: tint("237,230,214", 0.55) }}>
              WEEK SCORE — OF C
            </span>
          </div>
        </div>
      </div>

      {/* week of stars — the constellation */}
      <div
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "30px 48px 18px",
          animation: `mxRise 1.1s ${EASE} .4s both`,
        }}
      >
        <Constellation stars={data.stars} delayBase={0.4} />
      </div>

      {/* radar + right column */}
      <div
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "10px 48px 0",
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 44,
          alignItems: "stretch",
        }}
      >
        {/* life-wheel */}
        <div
          style={{
            background: PANEL,
            border: `1px solid ${tint("237,230,214", 0.1)}`,
            borderRadius: 2,
            padding: "32px 36px",
            animation: `mxRise 1.1s ${EASE} 1.1s both`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: "0.32em", color: tint("237,230,214", 0.6) }}>
              THE LIFE-WHEEL — BASELINE VS NOW
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontStyle: "italic",
                fontSize: 14,
                color: tint("237,230,214", 0.45),
              }}
            >
              drawn slowly, as it was earned
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", padding: "18px 0 6px" }}>
            <LifeWheel radar={data.radar} delayBase={1.1} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 34 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 1, background: tint("237,230,214", 0.4) }} />
              <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: "0.24em", color: tint("237,230,214", 0.5) }}>
                BASELINE — THE FIRST MEETING
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 2, background: GOLD }} />
              <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: "0.24em", color: GOLD }}>
                NOW — WEEK {weekNum}
              </span>
            </div>
          </div>
        </div>

        {/* right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* execution per god */}
          <div
            style={{
              background: PANEL,
              border: `1px solid ${tint("237,230,214", 0.1)}`,
              borderRadius: 2,
              padding: "30px 34px",
              animation: `mxRise 1.1s ${EASE} 1.4s both`,
            }}
          >
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: "0.32em", color: tint("237,230,214", 0.6) }}>
              EXECUTION — PER GOD
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 17, marginTop: 22 }}>
              {data.bars.map((b, i) => {
                const g = GODS_DESIGN[b.godId];
                const has = b.pct !== null;
                return (
                  <div key={b.godId} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span
                      style={{
                        width: 104,
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 9,
                        letterSpacing: "0.22em",
                        color: has ? g.hue : tint("237,230,214", 0.35),
                      }}
                    >
                      {godName(b.godId)}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: tint("237,230,214", has ? 0.1 : 0.08),
                        overflow: "hidden",
                      }}
                    >
                      {has && (
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, b.pct ?? 0))}%`,
                            height: "100%",
                            background: g.hue,
                            transformOrigin: "left",
                            animation: `mxGrow 1.6s ${EASE} ${1.7 + i * 0.15}s both`,
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        width: 44,
                        textAlign: "right",
                        fontFamily: "'Fraunces',Georgia,serif",
                        fontStyle: "italic",
                        fontSize: 17,
                        color: has ? INK : tint("237,230,214", 0.4),
                      }}
                    >
                      {has ? b.pct : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* candor flame */}
          <div
            style={{
              flex: 1,
              background: PANEL,
              border: `1px solid ${tint("237,230,214", 0.1)}`,
              borderRadius: 2,
              padding: "30px 34px",
              display: "flex",
              alignItems: "center",
              gap: 28,
              animation: `mxRise 1.1s ${EASE} 1.7s both`,
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="rgba(198,161,91,.16)"
              stroke={GOLD}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 14px rgba(198,161,91,.6))", animation: "mxBreathe 5s ease-in-out infinite", flex: "none" }}
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span
                  style={{
                    fontFamily: "'Fraunces',Georgia,serif",
                    fontStyle: "italic",
                    fontWeight: 330,
                    fontSize: 64,
                    lineHeight: 1,
                    color: GOLD,
                  }}
                >
                  {roman(data.candor.streak)}
                </span>
                <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: "0.3em", color: tint("237,230,214", 0.6) }}>
                  WEEKS OF CANDOR — UNBROKEN
                </span>
              </div>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: tint("237,230,214", 0.5),
                }}
              >
                {data.candor.totalAnswers} honest answers, and not one hidden from the council. The flame holds.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          padding: "40px 48px 0",
          animation: `mxRise 1.1s ${EASE} 2s both`,
        }}
      >
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: "0.3em", color: tint("237,230,214", 0.4) }}>
          THE WEEK IS A POEM — READ SLOWLY
        </span>
        <button
          type="button"
          onClick={onReturn}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "'Cormorant SC',serif",
            fontSize: 10,
            letterSpacing: "0.3em",
            color: GOLD,
          }}
        >
          RETURN TO OLYMPUS —
        </button>
      </div>

      {/* grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "url('/assets/grain.svg')",
          backgroundSize: "280px 280px",
          opacity: 0.07,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
