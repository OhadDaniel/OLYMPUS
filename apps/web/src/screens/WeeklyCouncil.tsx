import { useCallback, useEffect, useRef, useState } from "react";
import type { GodId } from "../../../../src/types.js";
import { API_URL } from "../lib/api.js";
import { GODS_DESIGN } from "../lib/design.js";
import { GodIcon } from "../components/GodIcon.js";

/* ------------------------------------------------------------------ *
 * The Weekly Council — the Rite of Review.
 * Five voices report (lifecycle spawn → working → done/silent), then
 * Zeus speaks a streamed verdict (wins → data → tips → questions) and
 * a NEXT WEEK diff card offers the one change. CONVENE AGAIN replays.
 * Data arrives over POST /council/start as an SSE stream.
 * ------------------------------------------------------------------ */

// ---- SSE frames the council stream emits -------------------------------
interface CouncilReport {
  godId: GodId;
  headline: string;
  wins: string[];
  concerns: string[];
  tip: string;
  oneQuestion: string;
}
type CouncilFrame =
  | { type: "status"; text: string }
  | { type: "subagent"; godId: GodId; state: "spawned" | "working" | "done" | "silent" }
  | { type: "reports"; reports: CouncilReport[] }
  | { type: "token"; text: string }
  | { type: "proposal"; id: string }
  | { type: "done"; output: string };

/** POST /council/start and stream SSE frames (same `data: {json}\n\n` framing
 *  as streamChat). Resolves when the stream ends. */
async function streamCouncil(
  onFrame: (frame: CouncilFrame) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/council/start`, { method: "POST", signal });
  if (!res.ok || !res.body) throw new Error(`council request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onFrame(JSON.parse(payload) as CouncilFrame);
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

// ---- The arc of five (Zeus presides above; these five report) ----------
type GodState = "hidden" | "spawned" | "working" | "done" | "silent";
const COUNCIL: Array<{ id: GodId; arc: number; img: string }> = [
  { id: "athena", arc: 26, img: "athena-nike-live.gif" },
  { id: "asclepius", arc: 10, img: "asclepius-live.gif" },
  { id: "hermes", arc: 0, img: "hermes-live.gif" },
  { id: "hestia", arc: 10, img: "hestia-live.gif" },
  { id: "apollo", arc: 26, img: "apollo-laurel-live.gif" },
];
const COUNCIL_IDS: GodId[] = COUNCIL.map((g) => g.id);

// ---- Static "planned vs lived" data (design-authored; no wire source) --
const DATA_ROWS: Array<{ id: GodId; plan: number; live: number; label: string }> = [
  { id: "athena", plan: 100, live: 92, label: "12h / 11h" },
  { id: "asclepius", plan: 25, live: 17, label: "3h / 2h" },
  { id: "hermes", plan: 17, live: 0, label: "2h / —" },
  { id: "hestia", plan: 33, live: 33, label: "4h / 4h" },
  { id: "apollo", plan: 17, live: 9, label: "2h / 1h" },
];

// ---- Static NEXT WEEK diff (design-authored) ---------------------------
const DIFF_ROWS: Array<{
  glyph: string;
  rgb: string | null;
  label: string;
  when: string;
  strike?: boolean;
}> = [
  { glyph: "+", rgb: "79,140,130", label: "ADD — THIRD RUN", when: "Sat 08:00" },
  { glyph: "→", rgb: "124,140,166", label: "MOVE — DEEP WORK", when: "Thu 09:00 → 08:30" },
  { glyph: "+", rgb: "226,130,60", label: "ADD — CALL MOTHER", when: "Sun 17:00" },
  { glyph: "−", rgb: null, label: "REMOVE — LATE SYNC", when: "Thu — rest is sacred", strike: true },
];

const EASE = "cubic-bezier(.22,1,.36,1)";
const rise = (delay: number): string => `mxRise 1s ${EASE} ${delay}s both`;

// ---- A council card image: live gif, or a tinted plate on 404 ----------
function CardImage({ src, id, filter }: { src: string; id: GodId; filter: string }) {
  const [failed, setFailed] = useState(false);
  const g = GODS_DESIGN[id];
  if (failed) {
    return (
      <div
        style={{
          width: "100%",
          height: 104,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, rgba(${g.rgb},.18), rgba(11,10,16,.6))`,
          filter,
          transition: "filter 1.2s",
        }}
      >
        <GodIcon icon={g.icon} color={g.hue} size={34} />
      </div>
    );
  }
  return (
    <img
      src={`/assets/${src}`}
      alt={g.name}
      onError={() => setFailed(true)}
      style={{ width: "100%", height: 104, objectFit: "cover", filter, transition: "filter 1.2s" }}
    />
  );
}

export function WeeklyCouncil() {
  const [phase, setPhase] = useState<"rite" | "verdict">("rite");
  const [status, setStatus] = useState("");
  const [godStates, setGodStates] = useState<Record<GodId, GodState>>({
    zeus: "hidden",
    athena: "hidden",
    asclepius: "hidden",
    hermes: "hidden",
    hestia: "hidden",
    apollo: "hidden",
  });
  const [reports, setReports] = useState<Partial<Record<GodId, CouncilReport>>>({});
  const [synthesis, setSynthesis] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [diff, setDiff] = useState<"open" | "sealed">("open");
  const [convening, setConvening] = useState(false);

  const synthRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setGod = useCallback((id: GodId, s: GodState) => {
    setGodStates((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));
  }, []);

  const startRite = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Reset to the pristine rite.
    setPhase("rite");
    setStatus("");
    setSynthesis("");
    setDiff("open");
    setReports({});
    setStreaming(true);
    setConvening(true);
    setGodStates({
      zeus: "hidden",
      athena: "hidden",
      asclepius: "hidden",
      hermes: "hidden",
      hestia: "hidden",
      apollo: "hidden",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      await streamCouncil((frame) => {
        switch (frame.type) {
          case "status":
            setStatus(frame.text);
            break;
          case "subagent":
            setGod(frame.godId, frame.state);
            break;
          case "reports": {
            const map: Partial<Record<GodId, CouncilReport>> = {};
            for (const r of frame.reports) map[r.godId] = r;
            setReports(map);
            setPhase("verdict");
            break;
          }
          case "token":
            setPhase("verdict");
            setSynthesis((prev) => prev + frame.text);
            break;
          case "proposal":
            // proposal id noted; the diff card offers the seal.
            break;
          case "done":
            setStreaming(false);
            break;
        }
      }, ac.signal);
      setStreaming(false);
    } catch (err) {
      if (!ac.signal.aborted) {
        setStreaming(false);
        setStatus("The council could not convene — the line to Olympus is silent.");
      }
    } finally {
      if (!ac.signal.aborted) setConvening(false);
    }
  }, [setGod]);

  // Auto-convene on mount; abort any live stream on unmount.
  useEffect(() => {
    void startRite();
    return () => abortRef.current?.abort();
  }, [startRite]);

  // Scroll to the synthesis once the verdict rises.
  useEffect(() => {
    if (phase !== "verdict" || !synthRef.current) return;
    const el = synthRef.current;
    const t = window.setTimeout(
      () => window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" }),
      500,
    );
    return () => window.clearTimeout(t);
  }, [phase]);

  const wins = COUNCIL_IDS.flatMap((id) => reports[id]?.wins ?? []);
  const tips = COUNCIL_IDS.map((id) => ({ id, tip: reports[id]?.tip })).filter(
    (t): t is { id: GodId; tip: string } => Boolean(t.tip),
  );
  const questions = COUNCIL_IDS.map((id) => reports[id]?.oneQuestion).filter(
    (q): q is string => Boolean(q),
  );

  return (
    <div
      data-screen-label="The Weekly Council"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0B0A10",
        overflow: "hidden",
        paddingBottom: 90,
        color: "#EDE6D6",
        fontFamily: "'Schibsted Grotesk','Helvetica Neue',sans-serif",
      }}
    >
      {/* keyframe not in the global catalog */}
      <style>{`@keyframes mxWorkPulse{0%,100%{box-shadow:0 0 0 0 rgba(198,161,91,0)}50%{box-shadow:0 0 34px 2px rgba(198,161,91,.2)}}`}</style>

      {/* Olympus haze */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 520,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <img
          src="/assets/olympus.gif"
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.14,
            filter: "grayscale(.4) brightness(.7)",
          }}
        />
        <div
          style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(11,10,16,.3), #0B0A10)" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: -300,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1200,
          height: 1200,
          background: "url('/assets/contours-ivory.svg') center / contain no-repeat",
          opacity: 0.16,
          animation: "mxSpin 380s linear infinite",
          pointerEvents: "none",
        }}
      />

      {/* header */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "26px 44px",
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 11,
            letterSpacing: ".32em",
            color: "rgba(237,230,214,.5)",
          }}
        >
          MAXWELL — THE RITE OF REVIEW
        </span>
        <button
          type="button"
          onClick={() => void startRite()}
          disabled={convening && streaming}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(198,161,91,.08)";
            e.currentTarget.style.borderColor = "#C6A15B";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(198,161,91,.4)";
          }}
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 10,
            letterSpacing: ".3em",
            color: "#C6A15B",
            background: "transparent",
            border: "1px solid rgba(198,161,91,.4)",
            padding: "10px 18px",
            borderRadius: 2,
            cursor: convening && streaming ? "default" : "pointer",
            opacity: convening && streaming ? 0.5 : 1,
            transition: `all .7s ${EASE}`,
          }}
        >
          CONVENE AGAIN —
        </button>
      </div>

      {/* Zeus presiding */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "12px 0 40px",
          animation: `mxRise 1.2s ${EASE} .2s both`,
        }}
      >
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 13, letterSpacing: ".54em", color: "#C6A15B" }}>
          THE WEEKLY COUNCIL
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: "'Fraunces',Georgia,serif",
            fontWeight: 330,
            fontSize: 64,
            lineHeight: 1,
            color: "#EDE6D6",
          }}
        >
          Week XXVIII, weighed
        </h1>
        <span
          style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontStyle: "italic",
            fontSize: 19,
            color: "rgba(237,230,214,.65)",
          }}
        >
          Five voices report. One verdict is spoken.
        </span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%, #E8C87E, #C6A15B 62%, #9A7B40)",
              animation: "mxOrb 5.6s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "'Cormorant SC',serif",
              fontSize: 10,
              letterSpacing: ".4em",
              color: "rgba(237,230,214,.5)",
            }}
          >
            ZEUS — PRESIDING
          </span>
          {phase === "rite" && status && (
            <span
              style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontStyle: "italic",
                fontSize: 14,
                color: "rgba(237,230,214,.45)",
                animation: `mxToken .6s ${EASE} both`,
              }}
            >
              {status}
            </span>
          )}
        </div>
      </div>

      {/* the council arc */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 18,
          maxWidth: 1260,
          margin: "0 auto",
          padding: "0 44px",
        }}
      >
        {COUNCIL.map((g) => {
          const st = godStates[g.id];
          const d = GODS_DESIGN[g.id];
          const working = st === "working";
          const done = st === "done";
          const silent = st === "silent";
          const visible = st !== "hidden";
          const anim = working
            ? `mxRise .9s ${EASE} both, mxWorkPulse 2.2s ease-in-out .9s infinite`
            : st === "spawned"
              ? `mxRise .9s ${EASE} both`
              : "none";
          return (
            <div key={g.id} style={{ transform: `translateY(${g.arc}px)` }}>
              <div
                style={{
                  opacity: visible ? (silent ? 0.5 : 1) : 0,
                  animation: anim,
                  background: "#15141B",
                  border: `1px solid ${done ? `rgba(${d.rgb},.55)` : "rgba(237,230,214,.12)"}`,
                  borderRadius: 2,
                  overflow: "hidden",
                  transition: "border-color 1.2s, opacity 1.2s",
                }}
              >
                <div
                  style={{
                    height: 2,
                    background: done ? d.hue : "rgba(237,230,214,.1)",
                    transition: "background 1.2s",
                  }}
                />
                <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <CardImage
                    src={g.img}
                    id={g.id}
                    filter={done ? "grayscale(0) brightness(.95)" : "grayscale(1) brightness(.55)"}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span
                      style={{
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 12,
                        letterSpacing: ".26em",
                        color: done ? d.hue : "rgba(237,230,214,.65)",
                        transition: "color 1.2s",
                      }}
                    >
                      {d.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 8,
                        letterSpacing: ".24em",
                        color: "rgba(237,230,214,.4)",
                      }}
                    >
                      {d.domain}
                    </span>
                  </div>
                  <div style={{ minHeight: 70, display: "flex", alignItems: "flex-start" }}>
                    {working && (
                      <span
                        style={{
                          fontFamily: "'Cormorant SC',serif",
                          fontSize: 10,
                          letterSpacing: ".26em",
                          color: "#E8C87E",
                          animation: "mxShimmer 2s ease-in-out infinite",
                        }}
                      >
                        WEIGHING THE WEEK…
                      </span>
                    )}
                    {done && (
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            transform: "rotate(45deg)",
                            background: d.hue,
                            flex: "none",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond',Georgia,serif",
                            fontStyle: "italic",
                            fontSize: 14.5,
                            lineHeight: 1.5,
                            color: "#EDE6D6",
                          }}
                        >
                          {reports[g.id]?.headline ?? ""}
                        </span>
                      </div>
                    )}
                    {silent && (
                      <span
                        style={{
                          fontFamily: "'Cormorant SC',serif",
                          fontSize: 10,
                          letterSpacing: ".3em",
                          color: "rgba(237,230,214,.35)",
                        }}
                      >
                        SILENT THIS WEEK
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* the verdict */}
      {phase === "verdict" && (
        <div
          ref={synthRef}
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 880,
            margin: "0 auto",
            padding: "70px 44px 0",
            display: "flex",
            flexDirection: "column",
            gap: 44,
          }}
        >
          {/* divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, animation: rise(0.2) }}>
            <div style={{ flex: 1, height: 1, background: "rgba(198,161,91,.35)" }} />
            <span
              style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".44em", color: "#C6A15B" }}
            >
              ZEUS SPEAKS — THE SYNTHESIS
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(198,161,91,.35)" }} />
          </div>

          {/* streamed synthesis */}
          {synthesis && (
            <p
              style={{
                margin: 0,
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontStyle: "italic",
                fontSize: 20,
                lineHeight: 1.6,
                color: "rgba(237,230,214,.9)",
              }}
            >
              {synthesis}
              {streaming && (
                <span style={{ color: "#E8C87E", animation: "mxShimmer 1.2s ease-in-out infinite" }}>▍</span>
              )}
            </p>
          )}

          {/* the wins */}
          {wins.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: rise(0.6) }}>
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 11,
                  letterSpacing: ".32em",
                  color: "rgba(237,230,214,.5)",
                }}
              >
                THE WINS
              </span>
              {wins.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <div
                    style={{ width: 5, height: 5, transform: "rotate(45deg)", background: "#C6A15B", flex: "none" }}
                  />
                  <span style={{ fontSize: 17, lineHeight: 1.6, color: "#EDE6D6" }}>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* the data — planned vs lived */}
          <div
            style={{
              display: "flex",
              gap: 48,
              alignItems: "center",
              borderTop: "1px solid rgba(237,230,214,.12)",
              borderBottom: "1px solid rgba(237,230,214,.12)",
              padding: "30px 0",
              animation: rise(1.4),
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "none" }}>
              <span
                style={{
                  fontFamily: "'Fraunces',Georgia,serif",
                  fontStyle: "italic",
                  fontWeight: 330,
                  fontSize: 108,
                  lineHeight: 1,
                  color: "#C6A15B",
                }}
              >
                82
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 10,
                  letterSpacing: ".34em",
                  color: "rgba(237,230,214,.5)",
                }}
              >
                EXECUTION — OF C
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: "'Cormorant SC',serif",
                    fontSize: 10,
                    letterSpacing: ".3em",
                    color: "rgba(237,230,214,.5)",
                  }}
                >
                  THE DATA — PLANNED VS LIVED
                </span>
                <span
                  style={{
                    fontFamily: "'Cormorant SC',serif",
                    fontSize: 10,
                    letterSpacing: ".24em",
                    color: "rgba(237,230,214,.4)",
                  }}
                >
                  23H SWORN · 18H KEPT
                </span>
              </div>
              {DATA_ROWS.map((row) => {
                const d = GODS_DESIGN[row.id];
                return (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                      style={{
                        width: 86,
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 9,
                        letterSpacing: ".2em",
                        color: d.hue,
                      }}
                    >
                      {d.name}
                    </span>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ height: 3, width: `${row.plan}%`, background: "rgba(237,230,214,.18)" }} />
                      <div style={{ height: 3, width: `${row.live}%`, background: d.hue }} />
                    </div>
                    <span
                      style={{ width: 64, textAlign: "right", fontSize: 10.5, color: "rgba(237,230,214,.5)" }}
                    >
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* one tip per god */}
          {tips.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: rise(2.4) }}>
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 11,
                  letterSpacing: ".32em",
                  color: "rgba(237,230,214,.5)",
                }}
              >
                ONE TIP PER GOD
              </span>
              {tips.map(({ id, tip }) => {
                const d = GODS_DESIGN[id];
                return (
                  <div key={id} style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <span
                      style={{
                        width: 86,
                        flex: "none",
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 9,
                        letterSpacing: ".2em",
                        color: d.hue,
                      }}
                    >
                      {d.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',Georgia,serif",
                        fontStyle: "italic",
                        fontSize: 16.5,
                        color: "rgba(237,230,214,.85)",
                      }}
                    >
                      {tip}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* zeus asks you */}
          {questions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: rise(3.4) }}>
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 11,
                  letterSpacing: ".32em",
                  color: "rgba(237,230,214,.5)",
                }}
              >
                ZEUS ASKS YOU
              </span>
              {questions.map((q, i) => (
                <p
                  key={i}
                  style={{
                    margin: 0,
                    fontFamily: "'Cormorant Garamond',Georgia,serif",
                    fontStyle: "italic",
                    fontSize: 21,
                    lineHeight: 1.5,
                    color: i === questions.length - 1 ? "#E8C87E" : "#EDE6D6",
                  }}
                >
                  {q}
                </p>
              ))}
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 9,
                  letterSpacing: ".3em",
                  color: "rgba(237,230,214,.4)",
                }}
              >
                ANSWER IN THE COUNCIL — THE GODS REMEMBER
              </span>
            </div>
          )}

          {/* next week — one diff */}
          <div
            style={{
              alignSelf: "center",
              width: 640,
              maxWidth: "100%",
              background: "#15141B",
              border: `1px solid ${diff === "sealed" ? "#C6A15B" : "rgba(198,161,91,.45)"}`,
              borderRadius: 2,
              padding: "26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 13,
              transition: "border-color 1s",
              animation: `mxRiseUp 1.2s ${EASE} 4.6s both`,
              boxShadow: "0 40px 90px -40px rgba(0,0,0,.8)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span
                style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".34em", color: "#C6A15B" }}
              >
                NEXT WEEK — ONE DIFF
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "'Fraunces',Georgia,serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "rgba(237,230,214,.5)",
                }}
              >
                Week XXIX
              </span>
            </div>
            {DIFF_ROWS.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 13,
                  background: r.rgb ? `rgba(${r.rgb},.08)` : "rgba(237,230,214,.04)",
                  border: `1px solid ${r.rgb ? `rgba(${r.rgb},.35)` : "rgba(237,230,214,.18)"}`,
                  borderRadius: 2,
                  padding: "12px 15px",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Fraunces',Georgia,serif",
                    fontSize: 16,
                    color: r.rgb ? `rgb(${r.rgb})` : "rgba(237,230,214,.5)",
                  }}
                >
                  {r.glyph}
                </span>
                <span
                  style={{
                    fontFamily: "'Cormorant SC',serif",
                    fontSize: 11,
                    letterSpacing: ".22em",
                    color: r.strike ? "rgba(237,230,214,.6)" : "#EDE6D6",
                    textDecoration: r.strike ? "line-through" : "none",
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: r.strike ? "rgba(237,230,214,.4)" : "rgba(237,230,214,.5)",
                  }}
                >
                  {r.when}
                </span>
              </div>
            ))}
            {diff === "open" && (
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setDiff("sealed")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#C6A15B";
                    e.currentTarget.style.color = "#0B0A10";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#E8C87E";
                  }}
                  style={{
                    fontFamily: "'Cormorant SC',serif",
                    fontSize: 12,
                    letterSpacing: ".32em",
                    color: "#E8C87E",
                    background: "transparent",
                    border: "1px solid #C6A15B",
                    padding: "14px 28px",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: `all .8s ${EASE}`,
                  }}
                >
                  SEAL NEXT WEEK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    /* amend flows to the Loom */
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "rgba(237,230,214,.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(237,230,214,.45)";
                  }}
                  style={{
                    fontFamily: "'Cormorant SC',serif",
                    fontSize: 10,
                    letterSpacing: ".3em",
                    color: "rgba(237,230,214,.45)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "color .7s",
                  }}
                >
                  AMEND IN THE LOOM —
                </button>
              </div>
            )}
            {diff === "sealed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <div style={{ width: 6, height: 6, background: "#E8C87E", transform: "rotate(45deg)" }} />
                <span
                  style={{
                    fontFamily: "'Cormorant SC',serif",
                    fontSize: 11,
                    letterSpacing: ".3em",
                    color: "#E8C87E",
                  }}
                >
                  SEALED — WEEK XXIX IS WOVEN
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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
