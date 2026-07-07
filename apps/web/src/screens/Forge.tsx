import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fetchForge, googleAuthUrl, linkTelegram, type ForgeStatus } from "../lib/insight.js";
import { GODS_DESIGN, roman } from "../lib/design.js";
import type { GodId } from "../../../../src/types.js";

/* ── palette lifted verbatim from the prototype ───────────────────────────── */
const CARD = "#FBF9F4";
const HAIR = "#D8D0C0";
const HAIR_SOFT = "#ECE7DB";
const INK = "#14131A";
const INK2 = "#4A4740";
const MIST = "#8A857A";
const GOLD = "#C6A15B";
const GOLD_BRIGHT = "#E8C87E";

const EASE = "cubic-bezier(.22,1,.36,1)";

/* ── a button that swaps to a hover style on pointer enter/leave ───────────── */
function HoverButton({
  base,
  hover,
  children,
  onClick,
  title,
}: {
  base: CSSProperties;
  hover: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{ ...base, ...(over ? hover : {}) }}
    >
      {children}
    </button>
  );
}

/* small stepper (−/+) used by Quiet Hours */
function StepButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <HoverButton
      onClick={onClick}
      base={{
        width: 28,
        height: 28,
        fontFamily: "'Fraunces',Georgia,serif",
        fontSize: 15,
        color: INK2,
        background: "transparent",
        border: `1px solid ${HAIR}`,
        borderRadius: 2,
        cursor: "pointer",
        transition: "all .6s",
      }}
      hover={{ borderColor: GOLD, color: GOLD }}
    >
      {children}
    </HoverButton>
  );
}

/* follow-through row order + design colors (per the prototype frieze) */
const FOLLOW_ORDER: GodId[] = ["athena", "asclepius", "hermes", "hestia", "apollo"];
const FOLLOW_FALLBACK: Record<string, number> = {
  athena: 88,
  asclepius: 71,
  hermes: 94,
  hestia: 97,
  apollo: 64,
};

const TONE_WORDS = ["gentle", "measured", "direct", "blunt"] as const;
const toneToPct: Record<string, number> = { gentle: 25, measured: 46, direct: 68, blunt: 90 };
function toneWordOf(v: number): string {
  return v < 35 ? "Gentle" : v < 58 ? "Measured" : v < 80 ? "Direct" : "Blunt";
}

/** "22:00" → 22 ; falls back to `def` when absent/unparseable */
function parseHour(s: string | undefined, def: number): number {
  if (!s) return def;
  const n = parseInt(s.slice(0, 2), 10);
  return Number.isFinite(n) ? n : def;
}
const fmtHour = (h: number): string => (h < 10 ? "0" : "") + h + ":00";

/**
 * The Forge — Trust & Control. The Outer Gates (bindings), the Scroll (what
 * Maxwell obeys) and the Memory (follow-through + what he's learned). Calm marble.
 */
export function Forge() {
  // seeded with the prototype's defaults so the screen is alive before/without a backend
  const [bindings, setBindings] = useState({ google: true, telegram: true, mcp: false });
  const [tone, setTone] = useState(46);
  const [quiet, setQuiet] = useState({ start: 22, end: 7 });
  const [laws, setLaws] = useState<string[]>([
    "Friday nights belong to the table.",
    "Never move sleep for work.",
    "My mother's calls are sacred.",
  ]);
  const [lawDraft, setLawDraft] = useState("");
  const [followThrough, setFollowThrough] = useState<ForgeStatus["scroll"]["followThrough"]>(undefined);
  const [learned, setLearned] = useState<ForgeStatus["scroll"]["learned"]>(undefined);

  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchForge()
      .then((d) => {
        if (!alive || !d) return;
        setBindings(d.bindings);
        const p = d.scroll ?? {};
        if (p.constraints && p.constraints.length > 0) setLaws(p.constraints);
        if (p.preferences?.quietHours) {
          setQuiet({
            start: parseHour(p.preferences.quietHours.start, 22),
            end: parseHour(p.preferences.quietHours.end, 7),
          });
        }
        const t = p.preferences?.tone?.toLowerCase();
        if (t && t in toneToPct) setTone(toneToPct[t]);
        if (p.followThrough) setFollowThrough(p.followThrough);
        if (p.learned) setLearned(p.learned);
      })
      .catch(() => {
        /* offline — the seeded marble stands on its own */
      });
    return () => {
      alive = false;
    };
  }, []);

  /* tone dial */
  const setToneFromPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let v = (clientX - r.left) / r.width;
    v = Math.max(0, Math.min(1, v));
    setTone(Math.round(v * 100));
  };

  /* bindings */
  const bindKeys = ["google", "telegram", "mcp"] as const;
  const toggleBind = (key: (typeof bindKeys)[number]) => {
    const on = bindings[key];
    if (!on) {
      // BIND — kick off the real handshake for the two live integrations
      if (key === "google") {
        window.location.href = googleAuthUrl();
        return;
      }
      if (key === "telegram") {
        void linkTelegram().then(({ url }) => window.open(url, "_blank"));
        return;
      }
    }
    setBindings((s) => ({ ...s, [key]: !s[key] }));
  };

  const bindMeta = (key: (typeof bindKeys)[number]) => {
    const on = bindings[key];
    return {
      dot: on ? GOLD : "transparent",
      dotBorder: on ? "none" : `1px solid ${MIST}`,
      dotAnim: on ? "mxOrb 4s ease-in-out infinite" : "none",
      status: on ? "BOUND — READ ONLY" : "UNBOUND — THE GOD IS BLIND HERE",
      statusColor: on ? GOLD : MIST,
      btn: on ? "SEVER" : "BIND —",
    };
  };

  /* laws */
  const addLaw = () => {
    const t = lawDraft.trim();
    if (!t) return;
    setLaws((l) => [...l, t]);
    setLawDraft("");
  };

  /* follow-through rows (data when present, prototype values otherwise) */
  const followRows = FOLLOW_ORDER.map((id) => {
    const g = GODS_DESIGN[id];
    const ft = followThrough?.[id];
    const pct =
      ft && ft.scheduled > 0 ? Math.round((ft.done / ft.scheduled) * 100) : FOLLOW_FALLBACK[id] ?? 0;
    return { id, name: g.name, color: g.hue, pct };
  });

  const learnedCount = learned?.length ?? 31;
  const learnedNumeral = learned ? roman(learnedCount) : "XXXI";
  const latestLearned =
    learned && learned.length > 0
      ? learned[learned.length - 1].insight
      : "you guard Tuesday dawns; the council now schedules around them.";

  const cardBase: CSSProperties = {
    background: CARD,
    border: `1px solid ${HAIR}`,
    borderRadius: 2,
  };
  const scLabel: CSSProperties = { fontFamily: "'Cormorant SC',serif" };
  const cormItalic: CSSProperties = { fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic" };
  const fraunces: CSSProperties = { fontFamily: "'Fraunces',Georgia,serif" };

  const bindingCards: Array<{
    key: (typeof bindKeys)[number];
    title: string;
    line: string;
  }> = [
    { key: "google", title: "GOOGLE — CALENDAR & MAIL", line: "Hermes reads what the world sends. He never writes back." },
    { key: "telegram", title: "TELEGRAM — THE MESSENGER", line: "Promises made in passing, carried to the council." },
    { key: "mcp", title: "MCP — THE FAR PROVINCES", line: "Outer tools, admitted one by one, each behind its gate." },
  ];

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#F5F2EA",
        color: INK,
        overflow: "hidden",
        paddingBottom: 60,
        fontFamily: "'Schibsted Grotesk','Helvetica Neue',sans-serif",
      }}
    >
      {/* slowly rotating contour map */}
      <div
        style={{
          position: "absolute",
          top: -400,
          left: -320,
          width: 1100,
          height: 1100,
          background: "url('/assets/contours-ink.svg') center / contain no-repeat",
          opacity: 0.3,
          animation: "mxSpin 380s linear infinite",
          pointerEvents: "none",
        }}
      />

      {/* header */}
      <div
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "40px 48px 26px",
          display: "flex",
          alignItems: "flex-end",
          gap: 36,
          animation: `mxRise 1s ${EASE} .1s both`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h1 style={{ margin: 0, ...fraunces, fontWeight: 390, fontSize: 52, lineHeight: 1 }}>The Forge</h1>
          <span style={{ ...scLabel, fontSize: 11, letterSpacing: "0.3em", color: MIST }}>
            TRUST &amp; CONTROL — THE OUTER GATES · THE SCROLL · THE MEMORY
          </span>
        </div>
        <span style={{ marginLeft: "auto", ...cormItalic, fontSize: 19, color: INK2 }}>
          Each connection lets a god see. Nothing more.
        </span>
      </div>

      {/* bindings */}
      <div
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 48px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
          animation: `mxRise 1s ${EASE} .3s both`,
        }}
      >
        {bindingCards.map(({ key, title, line }) => {
          const m = bindMeta(key);
          return (
            <div key={key} style={{ ...cardBase, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: m.dot,
                    border: m.dotBorder,
                    animation: m.dotAnim,
                  }}
                />
                <span style={{ ...scLabel, fontSize: 12, letterSpacing: "0.26em" }}>{title}</span>
              </div>
              <span style={{ ...cormItalic, fontSize: 15, color: INK2 }}>{line}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
                <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.26em", color: m.statusColor }}>{m.status}</span>
                <HoverButton
                  onClick={() => toggleBind(key)}
                  base={{
                    marginLeft: "auto",
                    ...scLabel,
                    fontSize: 10,
                    letterSpacing: "0.24em",
                    color: MIST,
                    background: "transparent",
                    border: `1px solid ${HAIR}`,
                    padding: "8px 14px",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "all .7s",
                  }}
                  hover={{ color: INK2, borderColor: MIST }}
                >
                  {m.btn}
                </HoverButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* scroll + memory */}
      <div
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "24px 48px 0",
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* THE SCROLL */}
        <div style={{ ...cardBase, padding: "30px 34px", animation: `mxRise 1s ${EASE} .5s both` }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ ...scLabel, fontSize: 11, letterSpacing: "0.32em", color: INK }}>
              THE SCROLL — WHAT MAXWELL OBEYS
            </span>
            <span style={{ marginLeft: "auto", ...cormItalic, fontSize: 14, color: MIST }}>yours to edit, always</span>
          </div>

          {/* tone of counsel */}
          <div style={{ marginTop: 26 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.26em", color: MIST }}>TONE OF COUNSEL</span>
              <span style={{ ...fraunces, fontStyle: "italic", fontSize: 22, color: GOLD }}>{toneWordOf(tone)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
              <span style={{ ...scLabel, fontSize: 9, letterSpacing: "0.22em", color: MIST }}>GENTLE</span>
              <div
                ref={trackRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setToneFromPointer(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) setToneFromPointer(e.clientX);
                }}
                style={{ position: "relative", flex: 1, height: 26, cursor: "ew-resize", touchAction: "none" }}
              >
                <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 1, background: HAIR }} />
                <div style={{ position: "absolute", left: 0, top: 12, height: 1, width: `${tone}%`, background: GOLD }} />
                <div
                  style={{
                    position: "absolute",
                    top: 7,
                    left: `${tone}%`,
                    width: 11,
                    height: 11,
                    transform: "translateX(-50%) rotate(45deg)",
                    background: GOLD_BRIGHT,
                    boxShadow: "0 0 10px rgba(232,200,126,.6)",
                  }}
                />
              </div>
              <span style={{ ...scLabel, fontSize: 9, letterSpacing: "0.22em", color: MIST }}>BLUNT</span>
            </div>
          </div>

          <div style={{ height: 1, background: HAIR_SOFT, margin: "26px 0" }} />

          {/* quiet hours */}
          <div>
            <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.26em", color: MIST }}>
              QUIET HOURS — THE GODS DO NOT SPEAK
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StepButton onClick={() => setQuiet((q) => ({ ...q, start: Math.max(19, q.start - 1) }))}>−</StepButton>
                <StepButton onClick={() => setQuiet((q) => ({ ...q, start: Math.min(23, q.start + 1) }))}>+</StepButton>
              </div>
              <span style={{ ...fraunces, fontStyle: "italic", fontSize: 30, color: INK }}>
                {fmtHour(quiet.start)} — {fmtHour(quiet.end)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StepButton onClick={() => setQuiet((q) => ({ ...q, end: Math.max(5, q.end - 1) }))}>−</StepButton>
                <StepButton onClick={() => setQuiet((q) => ({ ...q, end: Math.min(10, q.end + 1) }))}>+</StepButton>
              </div>
              <span style={{ marginLeft: "auto", ...scLabel, fontSize: 9, letterSpacing: "0.24em", color: MIST }}>
                ONLY HESTIA MAY KNOCK
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: HAIR_SOFT, margin: "26px 0" }} />

          {/* constraints */}
          <div>
            <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.26em", color: MIST }}>
              THE CONSTRAINTS — CARVED BY YOU
            </span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {laws.map((text, i) => (
                <div
                  key={`${i}-${text}`}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 16,
                    borderBottom: `1px solid ${HAIR_SOFT}`,
                    padding: "13px 2px",
                  }}
                >
                  <span style={{ ...fraunces, fontStyle: "italic", fontSize: 14, color: GOLD }}>{roman(i + 1)}</span>
                  <span style={{ ...cormItalic, fontSize: 18, color: INK }}>{text}</span>
                  <HoverButton
                    onClick={() => setLaws((l) => l.filter((_, idx) => idx !== i))}
                    title="strike this law"
                    base={{
                      marginLeft: "auto",
                      ...scLabel,
                      fontSize: 11,
                      color: MIST,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "color .6s",
                    }}
                    hover={{ color: "#E2823C" }}
                  >
                    ×
                  </HoverButton>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 14 }}>
              <input
                value={lawDraft}
                onChange={(e) => setLawDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLaw();
                }}
                placeholder="carve a new law…"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = GOLD)}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = HAIR)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${HAIR}`,
                  outline: "none",
                  ...cormItalic,
                  fontSize: 18,
                  color: INK,
                  padding: "8px 2px",
                  caretColor: GOLD,
                  transition: "border-color .7s",
                }}
              />
              <HoverButton
                onClick={addLaw}
                base={{
                  ...scLabel,
                  fontSize: 10,
                  letterSpacing: "0.26em",
                  color: GOLD,
                  background: "transparent",
                  border: "1px solid rgba(198,161,91,.5)",
                  padding: "9px 16px",
                  borderRadius: 2,
                  cursor: "pointer",
                  transition: "all .7s",
                }}
                hover={{ background: "rgba(198,161,91,.08)" }}
              >
                CARVE —
              </HoverButton>
            </div>
          </div>
        </div>

        {/* MEMORY column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* follow-through per god */}
          <div style={{ ...cardBase, padding: "28px 32px", animation: `mxRise 1s ${EASE} .65s both` }}>
            <span style={{ ...scLabel, fontSize: 11, letterSpacing: "0.32em", color: INK }}>FOLLOW-THROUGH — PER GOD</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 20 }}>
              {followRows.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 96, ...scLabel, fontSize: 9, letterSpacing: "0.22em", color: r.color }}>
                    {r.name}
                  </span>
                  <div style={{ flex: 1, height: 3, background: HAIR_SOFT, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${r.pct}%`,
                        height: "100%",
                        background: r.color,
                        transformOrigin: "left",
                        animation: `mxGrow 1.4s ${EASE} ${0.9 + i * 0.1}s both`,
                      }}
                    />
                  </div>
                  <span style={{ width: 40, textAlign: "right", ...fraunces, fontStyle: "italic", fontSize: 15 }}>
                    {r.pct}
                  </span>
                </div>
              ))}
            </div>
            <span style={{ display: "block", marginTop: 18, ...cormItalic, fontSize: 14, color: MIST }}>
              How often each god's counsel, once sealed, was kept.
            </span>
          </div>

          {/* things learned */}
          <div
            style={{
              ...cardBase,
              padding: "28px 32px",
              display: "flex",
              alignItems: "center",
              gap: 26,
              animation: `mxRise 1s ${EASE} .8s both`,
            }}
          >
            <span style={{ ...fraunces, fontStyle: "italic", fontWeight: 330, fontSize: 66, lineHeight: 1, color: GOLD }}>
              {learnedNumeral}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.3em", color: INK2 }}>
                THINGS MAXWELL HAS LEARNED ABOUT YOU
              </span>
              <span style={{ ...cormItalic, fontSize: 15, color: MIST }}>Latest — {latestLearned}</span>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{ ...scLabel, fontSize: 10, letterSpacing: "0.28em", color: GOLD, textDecoration: "none" }}
              >
                READ THE FULL SCROLL —
              </a>
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
          padding: "34px 48px 0",
        }}
      >
        <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.28em", color: MIST }}>
          NOTHING LEAVES OLYMPUS — MEMORY IS VISIBLE, GATES ARE YOURS
        </span>
        <span style={{ ...scLabel, fontSize: 10, letterSpacing: "0.3em", color: GOLD }}>RETURN TO OLYMPUS —</span>
      </div>

      {/* grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "url('/assets/grain.svg')",
          backgroundSize: "280px 280px",
          opacity: 0.04,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
