import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GodId } from "../../../../src/types.js";
import { GODS_DESIGN } from "../lib/design.js";
import { Statue } from "../components/Statue.js";

/**
 * The First Meeting — the onboarding rite. A self-contained scripted ceremony:
 * interview → wheel → labors → passages → commitments → bridge → sealed.
 * No backend; every beat is local state, faithful to the design prototype.
 */

const EASE = "cubic-bezier(.22,1,.36,1)";
const INK = "#EDE6D6";
const GOLD = "#C6A15B";
const GOLD_LIT = "#E8C87E";
const VOID = "#0B0A10";
const CARD = "#15141B";

type Phase = "interview" | "wheel" | "goals" | "connect" | "commit" | "plan" | "sealed";
type ConnState = "idle" | "linking" | "sealed";
type CommitStatus = "pending" | "kept" | "dismissed";

interface Question {
  key: string;
  text: string;
  ph: string;
}
interface GodDef {
  key: GodId;
  name: string;
  hue: string;
  rgb: string;
  img: string;
  slot: string;
  kw: string[];
}
interface WheelDef {
  key: string;
  label: string;
  hue: string;
}
interface Commitment {
  id: string;
  title: string;
  meta: string;
  status: CommitStatus;
}
interface Goal {
  text: string;
  god: GodId;
}

const QUESTIONS: Question[] = [
  { key: "name", text: "Be welcome, mortal. I am Zeus — I chair your council. What shall I call you?", ph: "your name, plainly spoken" },
  { key: "career", text: "Where does your ambition point, this season? Name the work that must not slip.", ph: "the work, the launch, the climb…" },
  { key: "health", text: "How fares the temple — your body, your sleep, your strength?", ph: "honestly, now" },
  { key: "tasks", text: "What small errands gnaw quietly at your days?", ph: "papers, repairs, the unpaid, the unsent…" },
  { key: "family", text: "Who holds your hearth — the people and the home you return to?", ph: "names, tables, rooms" },
  { key: "self", text: "And what do you keep for yourself alone — craft, learning, light?", ph: "the thing you never schedule" },
];
const ROMANS = ["I", "II", "III", "IV", "V", "VI"];
const STAR_KEYS = ["name", "career", "health", "tasks", "family", "self"];
const STAR_POS: Array<[number, number]> = [
  [18, 78], [62, 40], [112, 26], [162, 38], [204, 72], [150, 98],
];

const GODS: GodDef[] = [
  { key: "athena", img: "athena-nike-live.gif", slot: "Deep Work — Mon · Wed · Fri 14:00", kw: ["work", "launch", "ship", "career", "promot", "startup", "job", "company", "project", "deck", "revenue", "client"] },
  { key: "asclepius", img: "asclepius-live.gif", slot: "Tue · Thu 07:00 — the temple", kw: ["run", "marathon", "gym", "train", "sleep", "weight", "health", "swim", "yoga", "doctor", "10k", "diet"] },
  { key: "hermes", img: "hermes-live.gif", slot: "Fri 16:00 — the errand run", kw: ["errand", "tax", "visa", "paper", "bank", "fix", "move", "renew", "passport", "car", "insurance", "admin"] },
  { key: "hestia", img: "hestia-live.gif", slot: "Fri 19:30 — the table", kw: ["family", "home", "kid", "dinner", "parent", "friend", "wife", "husband", "partner", "mom", "dad", "house"] },
  { key: "apollo", img: "apollo-laurel-live.gif", slot: "Sat 10:00 — the studio", kw: ["learn", "read", "paint", "music", "guitar", "book", "language", "craft", "draw", "course", "piano", "photo"] },
].map((g) => ({
  ...g,
  key: g.key as GodId,
  name: GODS_DESIGN[g.key as GodId].name,
  hue: GODS_DESIGN[g.key as GodId].hue,
  rgb: GODS_DESIGN[g.key as GodId].rgb,
}));

const WHEEL_DEF: WheelDef[] = [
  { key: "career", label: "CAREER — ATHENA", hue: "#7C8CA6" },
  { key: "health", label: "HEALTH — ASCLEPIUS", hue: "#4F8C82" },
  { key: "tasks", label: "TASKS — HERMES", hue: "#34A8A0" },
  { key: "family", label: "FAMILY — HESTIA", hue: "#E2823C" },
  { key: "self", label: "SELF — APOLLO", hue: "#E8A33D" },
];

const PHASES: Array<{ id: Phase; label: string }> = [
  { id: "interview", label: "INTERVIEW" },
  { id: "wheel", label: "THE WHEEL" },
  { id: "goals", label: "LABORS" },
  { id: "connect", label: "PASSAGES" },
  { id: "commit", label: "COMMITMENTS" },
  { id: "plan", label: "THE SEAL" },
];

const initialCommitments: Commitment[] = [
  { id: "dentist", title: "Dentist", meta: "GMAIL — THU 15:30", status: "pending" },
  { id: "flight", title: "Flight to Athens", meta: "GMAIL — MON 06:40", status: "pending" },
  { id: "maria", title: "Dinner with Maria", meta: "TELEGRAM — FRI 20:00", status: "pending" },
  { id: "review", title: "Quarterly review", meta: "CALENDAR — WED 11:00", status: "pending" },
];

const suggestGod = (text: string): GodId => {
  const t = (text || "").toLowerCase();
  for (const g of GODS) if (g.kw.some((k) => t.includes(k))) return g.key;
  return "athena";
};

// A ceremonial "pill" button in gold outline.
function RiteButton({
  onClick,
  children,
  strong = false,
  opacity = 1,
  fontSize = 12,
}: {
  onClick: () => void;
  children: React.ReactNode;
  strong?: boolean;
  opacity?: number;
  fontSize?: number;
}) {
  const [hover, setHover] = useState(false);
  const base: React.CSSProperties = {
    fontFamily: "'Cormorant SC',serif",
    fontSize: strong ? 13 : fontSize,
    letterSpacing: strong ? ".34em" : ".3em",
    background: "transparent",
    border: `1px solid ${strong ? GOLD : "rgba(198,161,91,.45)"}`,
    padding: strong ? "16px 34px" : "13px 26px",
    borderRadius: 2,
    cursor: "pointer",
    transition: `all ${strong ? ".8s" : ".7s"} ${EASE}`,
    opacity,
    color: strong ? GOLD_LIT : GOLD,
  };
  const hovered: React.CSSProperties = strong
    ? { background: GOLD, color: VOID }
    : { background: "rgba(198,161,91,.08)", borderColor: GOLD, color: GOLD_LIT };
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={hover ? { ...base, ...hovered } : base}
    >
      {children}
    </button>
  );
}

// A faint "PASS / WITHHOLD" text button.
function GhostButton({ onClick, children, size = 10 }: { onClick: () => void; children: React.ReactNode; size?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Cormorant SC',serif",
        fontSize: size,
        letterSpacing: ".3em",
        color: hover ? "rgba(237,230,214,.8)" : "rgba(237,230,214,.45)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "color .7s",
      }}
    >
      {children}
    </button>
  );
}

const hint = { fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".26em", color: "rgba(237,230,214,.35)" } as const;
const kicker = { fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".42em", color: GOLD } as const;
const lead = { fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 19, color: "rgba(237,230,214,.72)" } as const;

function QuestionBlock({ q, roman }: { q: Question; roman: string }) {
  return (
    <>
      <div style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".42em", color: GOLD }}>
        ZEUS ASKS — {roman} OF VI
      </div>
      <div
        style={{
          fontFamily: "'Fraunces',Georgia,serif",
          fontStyle: "italic",
          fontWeight: 340,
          fontSize: 31,
          lineHeight: 1.4,
          color: INK,
          marginTop: 16,
        }}
      >
        {q.text}
      </div>
    </>
  );
}

export function FirstMeeting({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<Phase>("interview");
  const [qIndex, setQIndex] = useState(0);
  const [prevQ, setPrevQ] = useState(-1);
  const [inputVal, setInputVal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wheel, setWheel] = useState<Record<string, number>>({ career: 50, health: 50, tasks: 50, family: 50, self: 50 });
  const [goalInput, setGoalInput] = useState("");
  const [pendingGoal, setPendingGoal] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [conn, setConn] = useState<{ google: ConnState; telegram: ConnState }>({ google: "idle", telegram: "idle" });
  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments);
  const [inputFocus, setInputFocus] = useState(false);
  const [goalFocus, setGoalFocus] = useState(false);

  const zeusRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  // Parallax on pointer move.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (zeusRef.current) zeusRef.current.style.transform = `translate3d(${nx * 9}px,${ny * 6}px,0)`;
        if (cloudRef.current) cloudRef.current.style.transform = `translate3d(${-nx * 10}px,${-ny * 6}px,0)`;
      });
    };
    window.addEventListener("mousemove", onMove);
    const capturedTimers = timers;
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      capturedTimers.current.forEach(clearTimeout);
    };
  }, []);

  const sealed = phase === "sealed";

  const advance = useCallback(() => {
    if (qIndex >= 5) setPhase("wheel");
    else {
      setPrevQ(qIndex);
      setQIndex((i) => i + 1);
      setInputVal("");
    }
  }, [qIndex]);

  const submitAnswer = useCallback(() => {
    const q = QUESTIONS[qIndex];
    setAnswers((a) => ({ ...a, [q.key]: inputVal.trim() }));
    advance();
  }, [qIndex, inputVal, advance]);

  const skipAnswer = useCallback(() => {
    const q = QUESTIONS[qIndex];
    setAnswers((a) => ({ ...a, [q.key]: "" }));
    advance();
  }, [qIndex, advance]);

  const setWheelFromEvent = (key: string, e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let v = (e.clientX - r.left) / r.width;
    v = Math.max(0, Math.min(1, v));
    setWheel((w) => ({ ...w, [key]: Math.round(v * 100) }));
  };

  const offerGoal = () => {
    const t = goalInput.trim();
    if (!t || goals.length >= 3) return;
    setPendingGoal(t);
    setGoalInput("");
  };
  const pickGod = (key: GodId) => {
    if (!pendingGoal || goals.length >= 3) return;
    setGoals((g) => [...g, { text: pendingGoal, god: key }]);
    setPendingGoal("");
  };
  const removeGoal = (i: number) => setGoals((g) => g.filter((_, idx) => idx !== i));

  const grant = (key: "google" | "telegram") => {
    if (conn[key] !== "idle") return;
    setConn((c) => ({ ...c, [key]: "linking" }));
    const t = window.setTimeout(() => {
      setConn((c) => ({ ...c, [key]: "sealed" }));
    }, 1700);
    timers.current.push(t);
  };

  const resolveCommit = (id: string, status: CommitStatus) =>
    setCommitments((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));

  // Derived --------------------------------------------------------------
  const litKeys = STAR_KEYS.filter((k) => (answers[k] || "").length > 0);
  const stars = STAR_KEYS.map((k, i) => {
    const lit = sealed || litKeys.includes(k);
    return { x: STAR_POS[i][0], y: STAR_POS[i][1], glowOp: lit ? 0.4 : 0, fill: lit ? GOLD_LIT : "rgba(237,230,214,.3)" };
  });
  const coverageLabel = `${sealed ? 6 : litKeys.length} OF 6`;

  const radarPts = WHEEL_DEF.map((w, i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    const r = (wheel[w.key] / 100) * 96;
    return [150 + r * Math.cos(a), 150 + r * Math.sin(a)] as [number, number];
  });
  const radarPoints = radarPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  const suggestedKey = pendingGoal ? suggestGod(pendingGoal) : null;
  const suggestedName = suggestedKey ? GODS.find((g) => g.key === suggestedKey)!.name : "";

  const allResolved = commitments.every((c) => c.status !== "pending");
  const anySealedConn = conn.google === "sealed" || conn.telegram === "sealed";

  const planItems = useMemo(() => {
    const items: Array<{ sign: string; hue: string; bg: string; border: string; label: string; meta: string; deco: string }> = [];
    goals.forEach((gl) => {
      const g = GODS.find((x) => x.key === gl.god)!;
      items.push({
        sign: "+",
        hue: g.hue,
        bg: `rgba(${g.rgb},.08)`,
        border: `1px solid rgba(${g.rgb},.35)`,
        label: "ADD — " + gl.text.toUpperCase(),
        meta: g.slot,
        deco: "none",
      });
    });
    items.push({ sign: "→", hue: "#7C8CA6", bg: "rgba(124,140,166,.08)", border: "1px solid rgba(124,140,166,.35)", label: "MOVE — STANDUP", meta: "09:00 → 09:30", deco: "none" });
    items.push({ sign: "−", hue: "#E2823C", bg: "rgba(226,130,60,.08)", border: "1px solid rgba(226,130,60,.35)", label: "REMOVE — LATE SYNC", meta: "Thu — rest is sacred", deco: "line-through" });
    return items;
  }, [goals]);

  const carvedCount = ["NO", "ONE", "TWO", "THREE", "FOUR"][commitments.filter((c) => c.status === "kept").length];
  const curIdx = PHASES.findIndex((p) => p.id === phase);
  const userName = (answers.name || "").trim() || "mortal";

  const q = QUESTIONS[qIndex];

  // ----------------------------------------------------------------------
  return (
    <div style={{ position: "relative", height: "100vh", minHeight: 820, overflow: "hidden", background: VOID, color: INK, fontFamily: "'Schibsted Grotesk','Helvetica Neue',sans-serif" }}>
      {/* sky: cloud-Olympus backdrop */}
      <div ref={cloudRef} style={{ position: "absolute", inset: "-3%" }}>
        <img
          src="/assets/olympus.gif"
          alt="Olympus in cloud"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(.35) brightness(.6) saturate(.7)", animation: `mxOlympusIn 3.6s ${EASE} .4s both` }}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 30%, transparent 12%, rgba(11,10,16,.9) 74%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(11,10,16,.35), rgba(11,10,16,.1) 30%, rgba(11,10,16,.75) 88%)" }} />
      <div style={{ position: "absolute", left: "-16%", top: "6%", width: 900, height: 900, background: "url('/assets/contours-ivory.svg') center / contain no-repeat", opacity: 0.2, animation: "mxSpin 360s linear infinite" }} />

      {/* ZEUS — distant monument in the storm */}
      <div style={{ position: "absolute", left: "4.5%", bottom: "9%", zIndex: 2 }}>
        <div ref={zeusRef}>
          <div style={{ animation: `mxRise 2.2s ${EASE} 2s both`, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", width: 540, height: 540, background: "radial-gradient(50% 50% at 50% 50%, rgba(198,161,91,.13), transparent 65%)", animation: "mxBreathe 9s ease-in-out infinite" }} />
            <div style={{ position: "relative", width: 280, animation: "mxDrift 18s ease-in-out infinite", filter: "drop-shadow(0 0 26px rgba(237,230,214,.16)) drop-shadow(0 40px 60px rgba(0,0,0,.5))" }}>
              <Statue src="zeus-monument.png" god={GODS_DESIGN.zeus} height={360} treatment="dark" animate="mxDrift 18s ease-in-out infinite" />
            </div>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 1, background: "rgba(198,161,91,.45)" }} />
                <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 13, letterSpacing: ".5em", color: GOLD }}>ZEUS</span>
                <div style={{ width: 38, height: 1, background: "rgba(198,161,91,.45)" }} />
              </div>
              <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 12, color: "rgba(237,230,214,.5)" }}>the chair attends, from afar</span>
            </div>
          </div>
        </div>
      </div>

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "30px 44px", animation: `mxRise 1.2s ${EASE} 1.6s both` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 13, letterSpacing: ".52em", color: GOLD }}>THE FIRST MEETING</span>
          <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 14, color: "rgba(237,230,214,.55)" }}>a rite of twenty-five minutes — unhurried</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <svg width="230" height="112" viewBox="0 0 230 112">
            <polyline points="18,78 62,40 112,26 162,38 204,72 150,98" fill="none" stroke="rgba(237,230,214,.16)" strokeWidth="1" />
            {stars.map((st, i) => (
              <g key={i}>
                <circle cx={st.x} cy={st.y} r="7" fill={GOLD_LIT} opacity={st.glowOp} style={{ transition: "opacity 1.6s" }} />
                <circle cx={st.x} cy={st.y} r="2.6" fill={st.fill} style={{ transition: "fill 1.6s" }} />
              </g>
            ))}
          </svg>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".32em", color: "rgba(237,230,214,.5)" }}>COVERAGE — {coverageLabel}</span>
        </div>
      </div>

      {/* rite content */}
      <div style={{ position: "absolute", right: "6%", top: "50%", transform: "translateY(-50%)", width: 620, zIndex: 5, animation: `mxRise 1.4s ${EASE} 2.4s both` }}>
        {/* (a) interview */}
        {phase === "interview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
            <div style={{ minHeight: 170 }}>
              <div style={{ position: "relative", minHeight: 150 }}>
                {prevQ >= 0 && (
                  <div key={"p" + prevQ} style={{ position: "absolute", inset: 0, animation: `mxRecede .9s ${EASE} both`, pointerEvents: "none" }}>
                    <QuestionBlock q={QUESTIONS[prevQ]} roman={ROMANS[prevQ]} />
                  </div>
                )}
                <div key={"q" + qIndex} style={{ animation: `mxRise 1.1s ${EASE} .15s both` }}>
                  <QuestionBlock q={q} roman={ROMANS[qIndex]} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
                onFocus={() => setInputFocus(true)}
                onBlur={() => setInputFocus(false)}
                placeholder={q.ph}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${inputFocus ? GOLD : "rgba(237,230,214,.28)"}`,
                  outline: "none",
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontStyle: "italic",
                  fontSize: 25,
                  color: INK,
                  padding: "10px 2px",
                  caretColor: GOLD,
                  transition: "border-color .7s",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <RiteButton onClick={submitAnswer}>OFFER —</RiteButton>
                <GhostButton onClick={skipAnswer}>THE GOD NODS — PASS</GhostButton>
                <span style={{ marginLeft: "auto", ...hint }}>EACH ANSWER KINDLES A STAR</span>
              </div>
            </div>
          </div>
        )}

        {/* (c) the wheel */}
        {phase === "wheel" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 26, animation: `mxRise 1s ${EASE} both` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={kicker}>THE WHEEL — WHERE THE WEIGHT SITS</span>
              <span style={lead}>Set the balance as it is today — not as you wish it to be.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 36, alignItems: "center" }}>
              <svg width="300" height="300" viewBox="0 0 300 300">
                <polygon points="150,54 241.3,120.3 206.4,227.7 93.6,227.7 58.7,120.3" fill="none" stroke="rgba(237,230,214,.14)" strokeWidth="1" />
                <polygon points="150,86 210.9,130.2 187.6,201.8 112.4,201.8 89.1,130.2" fill="none" stroke="rgba(237,230,214,.12)" strokeWidth="1" />
                <polygon points="150,118 180.4,140.1 168.8,175.9 131.2,175.9 119.6,140.1" fill="none" stroke="rgba(237,230,214,.1)" strokeWidth="1" />
                <line x1="150" y1="150" x2="150" y2="54" stroke="rgba(237,230,214,.12)" strokeWidth="1" />
                <line x1="150" y1="150" x2="241.3" y2="120.3" stroke="rgba(237,230,214,.12)" strokeWidth="1" />
                <line x1="150" y1="150" x2="206.4" y2="227.7" stroke="rgba(237,230,214,.12)" strokeWidth="1" />
                <line x1="150" y1="150" x2="93.6" y2="227.7" stroke="rgba(237,230,214,.12)" strokeWidth="1" />
                <line x1="150" y1="150" x2="58.7" y2="120.3" stroke="rgba(237,230,214,.12)" strokeWidth="1" />
                <polygon points={radarPoints} fill="rgba(198,161,91,.16)" stroke={GOLD} strokeWidth="1.5" />
                {radarPts.map((p, i) => (
                  <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="3.2" fill={WHEEL_DEF[i].hue} />
                ))}
                <text x="150" y="40" textAnchor="middle" fill="rgba(237,230,214,.5)" style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".2em" }}>CAREER</text>
                <text x="252" y="112" textAnchor="middle" fill="rgba(237,230,214,.5)" style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".2em" }}>HEALTH</text>
                <text x="212" y="250" textAnchor="middle" fill="rgba(237,230,214,.5)" style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".2em" }}>TASKS</text>
                <text x="88" y="250" textAnchor="middle" fill="rgba(237,230,214,.5)" style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".2em" }}>FAMILY</text>
                <text x="48" y="112" textAnchor="middle" fill="rgba(237,230,214,.5)" style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".2em" }}>SELF</text>
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {WHEEL_DEF.map((w) => (
                  <div key={w.key} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ width: 150, fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".22em", color: w.hue }}>{w.label}</span>
                    <div
                      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setWheelFromEvent(w.key, e); }}
                      onPointerMove={(e) => { if (e.buttons === 1) setWheelFromEvent(w.key, e); }}
                      style={{ position: "relative", flex: 1, height: 26, cursor: "ew-resize", touchAction: "none" }}
                    >
                      <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 1, background: "rgba(237,230,214,.18)" }} />
                      <div style={{ position: "absolute", left: 0, top: 12, height: 1, width: `${wheel[w.key]}%`, background: w.hue }} />
                      <div style={{ position: "absolute", top: 7, left: `${wheel[w.key]}%`, width: 11, height: 11, transform: "translateX(-50%) rotate(45deg)", background: GOLD_LIT, boxShadow: "0 0 12px rgba(232,200,126,.5)" }} />
                    </div>
                    <span style={{ width: 34, textAlign: "right", fontFamily: "'Fraunces',Georgia,serif", fontStyle: "italic", fontSize: 16, color: INK }}>{wheel[w.key]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <RiteButton onClick={() => setPhase("goals")}>SET — THE WHEEL IS TRUE</RiteButton>
              <span style={hint}>DRAG THE GOLD MARKS</span>
            </div>
          </div>
        )}

        {/* (d) goals / labors */}
        {phase === "goals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: `mxRise 1s ${EASE} both` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={kicker}>THE LABORS — NAME ONE TO THREE</span>
              <span style={lead}>Speak them plainly. Each labor wakes the god who will carry it.</span>
            </div>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
              <input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") offerGoal(); }}
                onFocus={() => setGoalFocus(true)}
                onBlur={() => setGoalFocus(false)}
                placeholder={goals.length >= 3 ? "three labors are enough, mortal" : "run a marathon · ship the launch · call my mother weekly…"}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${goalFocus ? GOLD : "rgba(237,230,214,.28)"}`,
                  outline: "none",
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontStyle: "italic",
                  fontSize: 23,
                  color: INK,
                  padding: "9px 2px",
                  caretColor: GOLD,
                  transition: "border-color .7s",
                }}
              />
              <RiteButton onClick={offerGoal} fontSize={11}>OFFER —</RiteButton>
            </div>
            {!!pendingGoal && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 19, color: GOLD_LIT }}>“{pendingGoal}” — choose its god.</span>
                <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".28em", color: "rgba(237,230,214,.45)" }}>THE COUNCIL SUGGESTS — {suggestedName}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
              {GODS.map((g) => {
                const bound = goals.map((gl, i) => ({ ...gl, i })).filter((x) => x.god === g.key);
                const awake = bound.length > 0;
                const suggested = suggestedKey === g.key;
                return (
                  <div
                    key={g.key}
                    onClick={() => pickGod(g.key)}
                    style={{
                      background: CARD,
                      border: awake ? `1px solid ${g.hue}` : suggested ? `1px solid rgba(${g.rgb},.65)` : "1px solid rgba(237,230,214,.14)",
                      boxShadow: awake ? `0 0 36px rgba(${g.rgb},.28)` : "none",
                      transform: awake ? "scale(1.05)" : "scale(1)",
                      borderRadius: 2,
                      padding: "10px 10px 12px",
                      cursor: "pointer",
                      transition: `all 1.1s ${EASE}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ width: "100%", height: 86, overflow: "hidden", filter: awake ? "grayscale(0) brightness(.95)" : "grayscale(1) brightness(.55)", transition: `filter 1.1s ${EASE}` }}>
                      <Statue src={g.img} god={GODS_DESIGN[g.key]} height={86} treatment="plate" />
                    </div>
                    <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".22em", textAlign: "center", color: awake ? g.hue : suggested ? GOLD_LIT : "rgba(237,230,214,.6)", transition: "color 1.1s" }}>{g.name}</span>
                    {bound.map((x) => (
                      <span
                        key={x.i}
                        onClick={(e) => { e.stopPropagation(); removeGoal(x.i); }}
                        title="remove this labor"
                        style={{ fontFamily: "'Cormorant SC',serif", fontSize: 8, letterSpacing: ".18em", color: g.hue, border: `1px solid rgba(${g.rgb},.4)`, padding: "4px 6px", textAlign: "center", cursor: "pointer" }}
                      >
                        {x.text}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <RiteButton onClick={() => { if (goals.length > 0) setPhase("connect"); }} opacity={goals.length > 0 ? 1 : 0.35}>CARVE THE LABORS —</RiteButton>
              <span style={hint}>{["0", "I", "II", "III"][goals.length]} OF III NAMED</span>
            </div>
          </div>
        )}

        {/* (e) passages / consent */}
        {phase === "connect" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 26, animation: `mxRise 1s ${EASE} both` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={kicker}>PASSAGES — GRANT THE MESSENGER SIGHT</span>
              <span style={lead}>I will read what the world sends you, and carry it to the council. I read — I never write. Nothing leaves Olympus.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {(
                [
                  { key: "google" as const, title: "GOOGLE — CALENDAR & MAIL", desc: "Your commitments, as the world already wrote them." },
                  { key: "telegram" as const, title: "TELEGRAM — THE MESSENGER", desc: "Promises made in passing, kept by a god." },
                ]
              ).map((card) => {
                const state = conn[card.key];
                return (
                  <div key={card.key} style={{ background: CARD, border: "1px solid rgba(237,230,214,.14)", borderRadius: 2, padding: 24, display: "flex", flexDirection: "column", gap: 14, minHeight: 170 }}>
                    <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".26em", color: INK }}>{card.title}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 15, color: "rgba(237,230,214,.6)" }}>{card.desc}</span>
                    <div style={{ marginTop: "auto" }}>
                      {state === "idle" && <RiteButton onClick={() => grant(card.key)} fontSize={11}>GRANT PASSAGE —</RiteButton>}
                      {state === "linking" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: GOLD, animation: "mxOrb 1.8s ease-in-out infinite" }} />
                          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".28em", color: "rgba(237,230,214,.6)" }}>READING THE WEEK…</span>
                        </div>
                      )}
                      {state === "sealed" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 7, height: 7, background: GOLD_LIT, transform: "rotate(45deg)" }} />
                          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".28em", color: GOLD_LIT }}>SEALED — PASSAGE OPEN</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <RiteButton onClick={() => setPhase("commit")} opacity={anySealedConn ? 1 : 0.35}>THE MESSENGER RETURNS —</RiteButton>
              <GhostButton onClick={() => setPhase("commit")}>WITHHOLD FOR NOW — CONTINUE</GhostButton>
            </div>
          </div>
        )}

        {/* (f) surfaced commitments */}
        {phase === "commit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: `mxRise 1s ${EASE} both` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={kicker}>FOUND IN THE MAIL — COMMITMENTS SURFACE</span>
              <span style={lead}>Hermes returns with what the world already claims of you. Carve what is true; pass what is not.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {commitments.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    background: CARD,
                    border: `1px solid ${c.status === "kept" ? "rgba(198,161,91,.55)" : "rgba(237,230,214,.14)"}`,
                    borderRadius: 2,
                    padding: "15px 20px",
                    opacity: c.status === "dismissed" ? 0.35 : 1,
                    transition: `all .9s ${EASE}`,
                    animation: `mxRise .9s ${EASE} ${i * 0.14}s both`,
                  }}
                >
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 15, color: INK, textDecoration: c.status === "dismissed" ? "line-through" : "none" }}>{c.title}</span>
                    <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".26em", color: "rgba(237,230,214,.45)" }}>{c.meta}</span>
                  </div>
                  {c.status === "pending" ? (
                    <div style={{ display: "flex", gap: 10 }}>
                      <RiteButton onClick={() => resolveCommit(c.id, "kept")} fontSize={10}>CARVE</RiteButton>
                      <GhostBox onClick={() => resolveCommit(c.id, "dismissed")}>PASS</GhostBox>
                    </div>
                  ) : (
                    <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".26em", color: c.status === "kept" ? GOLD_LIT : "rgba(237,230,214,.4)" }}>
                      {c.status === "kept" ? "CARVED —" : "PASSED"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <RiteButton onClick={() => { if (allResolved) setPhase("plan"); }} opacity={allResolved ? 1 : 0.35}>WEAVE THE BRIDGE —</RiteButton>
              <span style={hint}>RESOLVE EACH CLAIM</span>
            </div>
          </div>
        )}

        {/* (g) bridge week — approvable diff */}
        {phase === "plan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: `mxRise 1s ${EASE} both` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={kicker}>THE BRIDGE WEEK — AN APPROVABLE DIFF</span>
              <span style={lead}>Seven days to cross from chaos into rhythm. Amend it, or seal it.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {planItems.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 14, background: p.bg, border: p.border, borderRadius: 2, padding: "13px 17px", animation: `mxRise .9s ${EASE} ${i * 0.12}s both` }}>
                  <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 17, color: p.hue }}>{p.sign}</span>
                  <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".22em", color: INK, textDecoration: p.deco }}>{p.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(237,230,214,.5)" }}>{p.meta}</span>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".28em", color: "rgba(237,230,214,.45)" }}>{carvedCount} COMMITMENTS ALREADY CARVED INTO THE LOOM</span>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <RiteButton onClick={() => setPhase("sealed")} strong>SEAL THE WEEK</RiteButton>
              <GhostButton onClick={() => setPhase("goals")}>AMEND — RETURN TO THE LABORS</GhostButton>
            </div>
          </div>
        )}
      </div>

      {/* rite steps */}
      <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 16, animation: `mxRise 1.2s ${EASE} 2.8s both` }}>
        {PHASES.map((p, i) => {
          const color = sealed ? "rgba(198,161,91,.6)" : i === curIdx ? GOLD_LIT : i < curIdx ? "rgba(198,161,91,.6)" : "rgba(237,230,214,.32)";
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 4, height: 4, transform: "rotate(45deg)", background: color, transition: "background 1s" }} />
              <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".3em", color, transition: "color 1s" }}>{p.label}</span>
            </div>
          );
        })}
      </div>

      {/* grain */}
      <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "url('/assets/grain.svg')", backgroundSize: "280px 280px", opacity: 0.07, mixBlendMode: "screen", pointerEvents: "none" }} />

      {/* final seal — the light is earned */}
      {sealed && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "#F5F2EA", overflow: "hidden", animation: `mxRise 1.6s ${EASE} both`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: -280, right: -220, width: 1000, height: 1000, background: "url('/assets/contours-ink.svg') center / contain no-repeat", opacity: 0.6, animation: "mxSpin 320s linear infinite" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 26, textAlign: "center", maxWidth: 820, padding: "0 40px" }}>
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".5em", color: GOLD }}>THE COUNCIL IS CONVENED</span>
            <h1 style={{ margin: 0, fontFamily: "'Fraunces',Georgia,serif", fontWeight: 380, fontSize: 76, lineHeight: 1.05, color: "#14131A" }}>
              Welcome to Olympus, <span style={{ fontStyle: "italic" }}>{userName}</span>.
            </h1>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.5, color: "#4A4740" }}>
              Six gods hold your week now. The Loom is warm, the bridge is laid — walk in light.
            </p>
            <svg width="230" height="112" viewBox="0 0 230 112">
              <polyline points="18,78 62,40 112,26 162,38 204,72 150,98" fill="none" stroke="rgba(20,19,26,.2)" strokeWidth="1" />
              {STAR_POS.map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="7" fill={GOLD_LIT} opacity="0.35" />
                  <circle cx={x} cy={y} r="2.6" fill={GOLD} />
                </g>
              ))}
            </svg>
            <SealLink onClick={() => onComplete?.()} />
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".3em", color: "#8A857A" }}>THE FIRST MEETING IS COMPLETE — THE LOOM AWAITS</span>
          </div>
          <div style={{ position: "absolute", inset: 0, background: "url('/assets/grain.svg')", backgroundSize: "280px 280px", opacity: 0.04, mixBlendMode: "multiply", pointerEvents: "none" }} />
        </div>
      )}

      {/* entry veil: dark → light reveal */}
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: VOID, pointerEvents: "none", animation: `mxVeil 2.6s ${EASE} .3s both` }} />
    </div>
  );
}

// A bordered ghost button used inline in commit cards (needs a border, unlike GhostButton).
function GhostBox({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Cormorant SC',serif",
        fontSize: 10,
        letterSpacing: ".24em",
        color: hover ? "rgba(237,230,214,.8)" : "rgba(237,230,214,.45)",
        background: "transparent",
        border: "1px solid rgba(237,230,214,.18)",
        padding: "9px 14px",
        borderRadius: 2,
        cursor: "pointer",
        transition: "all .7s",
      }}
    >
      {children}
    </button>
  );
}

// The "ENTER OLYMPUS" link on the seal overlay.
function SealLink({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Cormorant SC',serif",
        fontSize: 14,
        letterSpacing: ".4em",
        color: hover ? "#14131A" : GOLD,
        textDecoration: "none",
        border: "1px solid rgba(198,161,91,.5)",
        padding: "16px 34px",
        borderRadius: 2,
        background: hover ? "rgba(198,161,91,.1)" : "transparent",
        transition: `all .8s ${EASE}`,
      }}
    >
      ENTER OLYMPUS —
    </a>
  );
}
