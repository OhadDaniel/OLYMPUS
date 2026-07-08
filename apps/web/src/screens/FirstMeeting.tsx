import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { API_URL, streamChat } from "../lib/api.js";
import { GODS_DESIGN, GOD_ORDER, roman } from "../lib/design.js";
import type { GodId } from "../../../../src/types.js";
import { GodIcon } from "../components/GodIcon.js";
import { Statue } from "../components/Statue.js";

type Phase = "welcome" | "interview" | "wheel" | "goals" | "bindings" | "scan" | "bridge" | "sealed";
const PHASES: Array<[Phase, string]> = [
  ["interview", "INTERVIEW"],
  ["wheel", "THE WHEEL"],
  ["goals", "LABORS"],
  ["bindings", "PASSAGES"],
  ["scan", "THE INBOX"],
  ["bridge", "THE BRIDGE"],
  ["sealed", "THE SEAL"],
];
const WHEEL_GODS: GodId[] = ["athena", "asclepius", "hermes", "hestia", "apollo"];
const WHEEL_LABELS: Record<GodId, string> = { zeus: "COUNSEL", athena: "CAREER", asclepius: "HEALTH", hermes: "TASKS", hestia: "FAMILY", apollo: "SELF" };
const STATUE_SRC: Record<GodId, { src: string; treatment: "cutout" | "plate" | "dark" }> = {
  zeus: { src: "zeus-live.gif", treatment: "cutout" },
  athena: { src: "athena-nike-live.gif", treatment: "cutout" },
  apollo: { src: "apollo-laurel-live.gif", treatment: "cutout" },
  hermes: { src: "hermes-live.gif", treatment: "cutout" },
  asclepius: { src: "asclepius-live.gif", treatment: "plate" },
  hestia: { src: "hestia-live.gif", treatment: "plate" },
};

const post = (p: string, body?: unknown) =>
  fetch(`${API_URL}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
const get = (p: string) => fetch(`${API_URL}${p}`).then((r) => r.json());

const GOLD = "#C6A15B";
const IVORY = "#EDE6D6";
const dim = (a: number) => `rgba(237,230,214,${a})`;

interface Msg { role: "zeus" | "you"; text: string }
interface Insight { _id?: string; id?: string; summary: string; when?: string; godId?: GodId; handled?: boolean }

export function FirstMeeting({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [name, setName] = useState("");

  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "zeus", text: "Now — before I can carry any of it, I must know you. Let us begin, unhurried. What is your name?" },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const sessionId = useRef<string | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);

  const [wheel, setWheel] = useState<Record<GodId, number>>({ zeus: 5, athena: 5, asclepius: 5, hermes: 5, hestia: 5, apollo: 5 });
  const [goals, setGoals] = useState<Array<{ godId: GodId; title: string }>>([]);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalGod, setGoalGod] = useState<GodId>("athena");

  const [google, setGoogle] = useState(false);
  const [telegram, setTelegram] = useState(false);
  const [tgUrl, setTgUrl] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [scanned, setScanned] = useState(false);
  const [bridge, setBridge] = useState<{ proposalId: string | null; summary?: { adds: number } } | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshCoverage = useCallback(async () => {
    try {
      const s = await get("/onboarding/status");
      setCoverage(Math.min(6, (s.verify?.coveredAreas ?? []).length));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void get("/auth/google/status").then((s) => setGoogle(Boolean(s.connected))).catch(() => {});
    void get("/telegram/status").then((s) => setTelegram(Boolean(s.linked))).catch(() => {});
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!name) setName(text.split(/\s+/)[0] ?? text);
    setInput("");
    setMsgs((m) => [...m, { role: "you", text }, { role: "zeus", text: "" }]);
    setStreaming(true);
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
    try {
      await streamChat({ message: text, sessionId: sessionId.current }, (f) => {
        if (f.type === "session") sessionId.current = f.id;
        else if (f.type === "token")
          setMsgs((m) => {
            const c = m.slice();
            const last = c[c.length - 1];
            if (last && last.role === "zeus") c[c.length - 1] = { ...last, text: last.text + f.text };
            return c;
          });
        else if (f.type === "done" || f.type === "__end__") setStreaming(false);
      });
    } catch {
      /* ignore */
    }
    setStreaming(false);
    void refreshCoverage();
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
  };

  const connectGoogle = () => {
    window.open(`${API_URL}/auth/google`, "_blank", "width=520,height=680");
    const iv = setInterval(async () => {
      const s = await get("/auth/google/status").catch(() => ({ connected: false }));
      if (s.connected) { setGoogle(true); clearInterval(iv); }
    }, 2000);
    setTimeout(() => clearInterval(iv), 120000);
  };
  const connectTelegram = async () => {
    const { url } = await post("/telegram/link");
    setTgUrl(url);
    window.open(url, "_blank");
    const iv = setInterval(async () => {
      const s = await get("/telegram/status").catch(() => ({ linked: false }));
      if (s.linked) { setTelegram(true); clearInterval(iv); }
    }, 2000);
    setTimeout(() => clearInterval(iv), 120000);
  };

  const saveWheel = async () => { setBusy(true); await post("/onboarding/wheel", { values: Object.fromEntries(WHEEL_GODS.map((g) => [g, wheel[g]])) }); setBusy(false); setPhase("goals"); };
  const saveGoals = async () => { setBusy(true); if (goals.length) await post("/onboarding/goals", { goals }); setBusy(false); setPhase("bindings"); };
  const doScan = async () => { setBusy(true); try { const r = await post("/onboarding/scan-email"); setInsights(Array.isArray(r.insights) ? r.insights : []); } catch { /* ignore */ } setScanned(true); setBusy(false); };
  const confirmInsight = async (ins: Insight) => { const id = ins._id ?? ins.id; if (id) await post(`/onboarding/insights/${id}/confirm`); setInsights((xs) => xs.map((x) => (x === ins ? { ...x, handled: true } : x))); };
  const buildBridge = async () => { setBusy(true); const r = await post("/onboarding/bridge"); setBridge(r); setBusy(false); };
  const sealWeek = async () => { setBusy(true); if (bridge?.proposalId) await post(`/proposals/${bridge.proposalId}/approve`); await post("/onboarding/complete", { name: name || "Ohad", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); setBusy(false); setPhase("sealed"); };

  const label = (t: string, extra?: CSSProperties) => (
    <span className="font-label" style={{ fontSize: 11, letterSpacing: "0.42em", color: GOLD, ...extra }}>{t}</span>
  );
  const ghost = (t: string, onClick: () => void, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-label transition"
      style={{ fontSize: 12, letterSpacing: "0.3em", color: GOLD, background: "transparent", border: "1px solid rgba(198,161,91,.45)", padding: "13px 30px", borderRadius: 2, opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(198,161,91,.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {t}
    </button>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-void font-body" style={{ color: IVORY }}>
      <img src="/assets/olympus.gif" alt="" onError={(e) => (e.currentTarget.style.display = "none")} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ filter: "grayscale(.35) brightness(.45) saturate(.7)", opacity: 0.3, animation: "mxOlympusIn 3.6s var(--ease) .3s both" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 22%, transparent 8%, rgba(11,10,16,.92) 72%)" }} />
      <div className="mx-contours mx-contours-ivory" style={{ left: "50%", top: "-30%", marginLeft: -500, width: 1000, height: 1000, opacity: 0.12 }} />
      <div className="mx-grain" style={{ opacity: 0.06 }} />

      {/* coverage — top-right, from interview onward */}
      {phase !== "welcome" && phase !== "sealed" && (
        <div className="absolute right-11 top-8 z-10 flex flex-col items-end gap-1">
          <svg width="200" height="96" viewBox="0 0 230 112">
            <polyline points="18,78 62,40 112,26 162,38 204,72 150,98" fill="none" stroke={dim(0.16)} strokeWidth="1" />
            {([[18, 78], [62, 40], [112, 26], [162, 38], [204, 72], [150, 98]] as const).map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="7" fill="#E8C87E" opacity={i < coverage ? 0.4 : 0} style={{ transition: "opacity 1.6s" }} />
                <circle cx={x} cy={y} r="2.6" fill={i < coverage ? "#E8C87E" : dim(0.3)} style={{ transition: "fill 1.6s" }} />
              </g>
            ))}
          </svg>
          <span className="font-label" style={{ fontSize: 9, letterSpacing: "0.32em", color: dim(0.5) }}>COVERAGE — {roman(coverage)} OF VI</span>
        </div>
      )}

      {/* phase rail — bottom, from interview onward */}
      {phase !== "welcome" && phase !== "sealed" && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-7 px-11 py-6">
          {PHASES.map(([p, t]) => {
            const cur = PHASES.findIndex((x) => x[0] === phase);
            const me = PHASES.findIndex((x) => x[0] === p);
            return <span key={p} className="font-label" style={{ fontSize: 10, letterSpacing: "0.24em", color: p === phase ? "#E8C87E" : cur > me ? "rgba(198,161,91,.5)" : dim(0.28) }}>{t}</span>;
          })}
        </div>
      )}

      {/* CENTERED content */}
      <div className="relative z-[5] flex min-h-screen flex-col items-center justify-center px-6 py-24">
        <div className="w-full" style={{ maxWidth: phase === "welcome" ? 960 : 660 }}>

          {phase === "welcome" && (
            <div className="flex flex-col items-center gap-9 text-center" style={{ animation: "mxRise 1.4s var(--ease) both" }}>
              <div className="flex flex-col items-center gap-4">
                {label("THE FIRST MEETING", { letterSpacing: "0.52em" })}
                <h1 className="font-display" style={{ fontWeight: 400, fontSize: 52, lineHeight: 1.06, color: IVORY }}>I do not keep your week alone.</h1>
                <p className="font-voice italic" style={{ fontSize: 20, lineHeight: 1.5, color: dim(0.7), maxWidth: 620 }}>
                  I am Maxwell — and five gods sit my council. Each holds one domain of your life. Meet them; then I will learn you, and together we will design the week.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-5" style={{ maxWidth: 900 }}>
                {GOD_ORDER.map((g, i) => {
                  const gd = GODS_DESIGN[g];
                  const st = STATUE_SRC[g];
                  return (
                    <div key={g} className="flex flex-col items-center gap-3 p-4" style={{ border: `1px solid ${dim(0.12)}`, background: "rgba(237,230,214,.03)", animation: `mxRise .9s var(--ease) ${0.4 + i * 0.14}s both` }}>
                      <div style={{ height: 120, width: "100%" }}>
                        <Statue src={st.src} god={gd} height={120} treatment={st.treatment} />
                      </div>
                      <div className="flex items-center gap-2">
                        <GodIcon icon={gd.icon} color={gd.hue} size={16} />
                        <span className="font-display" style={{ fontSize: 20, letterSpacing: "0.1em", color: IVORY }}>{gd.name}</span>
                      </div>
                      <span className="font-label" style={{ fontSize: 9, letterSpacing: "0.24em", color: gd.hue }}>{gd.domain}</span>
                    </div>
                  );
                })}
              </div>

              {ghost("BEGIN THE MEETING —", () => setPhase("interview"))}
            </div>
          )}

          {phase === "interview" && (
            <div className="flex w-full flex-col gap-6">
              <div ref={scroller} className="flex max-h-[56vh] flex-col gap-6 overflow-y-auto px-2">
                {msgs.map((m, i) =>
                  m.role === "zeus" ? (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="font-label" style={{ fontSize: 9, letterSpacing: "0.3em", color: GOLD }}>MAXWELL</span>
                      <p className="font-voice italic" style={{ fontSize: 24, lineHeight: 1.45, color: IVORY }}>{m.text || "…"}</p>
                    </div>
                  ) : (
                    <p key={i} className="self-end" style={{ fontSize: 15, color: dim(0.65), background: "rgba(237,230,214,.06)", padding: "9px 16px", borderRadius: 2, maxWidth: "80%" }}>{m.text}</p>
                  ),
                )}
              </div>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder="offer your answer…" disabled={streaming}
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${dim(0.28)}`, outline: "none", fontFamily: "var(--font-voice)", fontStyle: "italic", fontSize: 25, color: IVORY, padding: "12px 2px", caretColor: GOLD, textAlign: "center" }} />
              <div className="flex items-center justify-center gap-6">
                {ghost("OFFER —", () => void send(), streaming || !input.trim())}
                {msgs.some((m) => m.role === "you") && ghost(coverage >= 3 ? "THE WHEEL —" : "MOVE ON — THE WHEEL", () => setPhase("wheel"), streaming)}
              </div>
              <span className="text-center font-label" style={{ fontSize: 9, letterSpacing: "0.26em", color: dim(0.4) }}>
                {coverage >= 3 ? "THE COUNCIL KNOWS YOU WELL ENOUGH — MOVE ON WHEN READY" : "EACH ANSWER KINDLES A STAR — OR MOVE ON WHENEVER YOU WISH"}
              </span>
            </div>
          )}

          {phase === "wheel" && (
            <div className="flex flex-col items-center gap-6 text-center">
              {label("THE WHEEL — WHERE THE WEIGHT SITS")}
              <span className="font-voice italic" style={{ fontSize: 18, color: dim(0.72) }}>Set the balance as it is today — not as you wish it to be.</span>
              <div className="flex w-full max-w-md flex-col gap-4">
                {WHEEL_GODS.map((g) => (
                  <div key={g} className="flex items-center gap-4">
                    <span className="font-label" style={{ width: 90, textAlign: "left", fontSize: 10, letterSpacing: "0.22em", color: GODS_DESIGN[g].hue }}>{WHEEL_LABELS[g]}</span>
                    <input type="range" min={1} max={10} value={wheel[g]} onChange={(e) => setWheel((w) => ({ ...w, [g]: Number(e.target.value) }))} style={{ flex: 1, accentColor: GODS_DESIGN[g].hue }} />
                    <span className="font-display italic" style={{ width: 28, fontSize: 20, color: GODS_DESIGN[g].hue }}>{wheel[g]}</span>
                  </div>
                ))}
              </div>
              {ghost(busy ? "SETTING…" : "SET THE WHEEL —", () => void saveWheel(), busy)}
            </div>
          )}

          {phase === "goals" && (
            <div className="flex flex-col items-center gap-6 text-center">
              {label("THE LABORS — NAME UP TO THREE")}
              <span className="font-voice italic" style={{ fontSize: 18, color: dim(0.72) }}>What are you reaching for? A god takes each into their keeping.</span>
              <div className="flex w-full max-w-lg flex-col gap-2">
                {goals.map((gl, i) => (
                  <div key={i} className="flex items-center gap-3" style={{ borderLeft: `2px solid ${GODS_DESIGN[gl.godId].hue}`, padding: "6px 12px", background: `rgba(${GODS_DESIGN[gl.godId].rgb},.08)` }}>
                    <span className="font-label" style={{ fontSize: 10, letterSpacing: "0.2em", color: GODS_DESIGN[gl.godId].hue }}>{GODS_DESIGN[gl.godId].name}</span>
                    <span style={{ fontSize: 15 }}>{gl.title}</span>
                    <button onClick={() => setGoals((xs) => xs.filter((_, j) => j !== i))} className="ml-auto text-mist" style={{ cursor: "pointer" }}>×</button>
                  </div>
                ))}
                {goals.length < 3 && (
                  <div className="flex items-center gap-3">
                    <select value={goalGod} onChange={(e) => setGoalGod(e.target.value as GodId)} className="bg-void2 font-label" style={{ color: GODS_DESIGN[goalGod].hue, border: `1px solid ${dim(0.2)}`, padding: 10, fontSize: 11 }}>
                      {GOD_ORDER.filter((g) => g !== "zeus").map((g) => <option key={g} value={g}>{GODS_DESIGN[g].name}</option>)}
                    </select>
                    <input value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && goalDraft.trim()) { setGoals((xs) => [...xs, { godId: goalGod, title: goalDraft.trim() }]); setGoalDraft(""); } }} placeholder="name a labor…" style={{ flex: 1, background: "transparent", borderBottom: `1px solid ${dim(0.28)}`, outline: "none", fontFamily: "var(--font-voice)", fontStyle: "italic", fontSize: 18, color: IVORY, padding: "8px 2px" }} />
                  </div>
                )}
              </div>
              {ghost(busy ? "BINDING…" : "BIND THE LABORS —", () => void saveGoals(), busy)}
            </div>
          )}

          {phase === "bindings" && (
            <div className="flex w-full flex-col items-center gap-6 text-center">
              {label("THE PASSAGES — I READ, I NEVER WRITE")}
              <span className="font-voice italic" style={{ fontSize: 18, color: dim(0.72) }}>Open the gates and the outer world flows in — read-only, always.</span>
              <div className="flex w-full max-w-lg flex-col gap-3">
                {[{ k: "google", bound: google, on: () => connectGoogle(), t: "GOOGLE — CALENDAR & INBOX" }, { k: "telegram", bound: telegram, on: () => void connectTelegram(), t: "TELEGRAM — THE MESSENGER" }].map((b) => (
                  <div key={b.k} className="flex items-center gap-4" style={{ border: `1px solid ${dim(0.16)}`, background: "rgba(237,230,214,.03)", padding: "18px 20px" }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: b.bound ? GOLD : "transparent", border: b.bound ? "none" : `1px solid ${dim(0.4)}`, boxShadow: b.bound ? `0 0 10px ${GOLD}` : "none", animation: b.bound ? "mxBreathe 4s ease-in-out infinite" : "none" }} />
                    <span className="font-label" style={{ fontSize: 11, letterSpacing: "0.24em" }}>{b.t}</span>
                    <span className="ml-auto font-label" style={{ fontSize: 10, letterSpacing: "0.2em", color: b.bound ? GOLD : dim(0.4) }}>{b.bound ? "SEALED — READ ONLY" : "UNBOUND"}</span>
                    {!b.bound && ghost("BIND —", b.on)}
                  </div>
                ))}
              </div>
              {tgUrl && !telegram && <span className="font-label" style={{ fontSize: 10, color: dim(0.5) }}>Tap the link on your phone, then return here…</span>}
              {ghost("THE INBOX —", () => setPhase("scan"))}
            </div>
          )}

          {phase === "scan" && (
            <div className="flex w-full flex-col items-center gap-6 text-center">
              {label("THE INBOX — COMMITMENTS HIDING IN YOUR MAIL")}
              {!scanned ? (
                <>
                  <span className="font-voice italic" style={{ fontSize: 18, color: dim(0.72) }}>Let me read your recent mail and surface what you may have forgotten.</span>
                  {ghost(busy ? "READING…" : "READ THE MAIL —", () => void doScan(), busy)}
                </>
              ) : (
                <>
                  <div className="flex w-full max-w-lg flex-col gap-2">
                    {insights.length === 0 ? (
                      <span className="font-voice italic" style={{ fontSize: 17, color: dim(0.6) }}>Nothing pressing hides in your inbox. Clean seas.</span>
                    ) : (
                      insights.map((ins, i) => (
                        <div key={i} className="flex items-center gap-3" style={{ border: `1px solid ${dim(0.16)}`, padding: "14px 16px", opacity: ins.handled ? 0.45 : 1 }}>
                          <span style={{ fontSize: 15, textAlign: "left" }}>{ins.summary}</span>
                          {!ins.handled ? <button onClick={() => void confirmInsight(ins)} className="ml-auto font-label" style={{ fontSize: 10, letterSpacing: "0.2em", color: GOLD, cursor: "pointer" }}>CARVE —</button> : <span className="ml-auto font-label" style={{ fontSize: 10, color: GOLD }}>✓ CARVED</span>}
                        </div>
                      ))
                    )}
                  </div>
                  {ghost("THE BRIDGE —", () => { setPhase("bridge"); void buildBridge(); })}
                </>
              )}
            </div>
          )}

          {phase === "bridge" && (
            <div className="flex flex-col items-center gap-6 text-center">
              {label("THE BRIDGE — YOUR FIRST FEW DAYS")}
              {!bridge ? (
                <span className="font-voice italic" style={{ fontSize: 18, color: dim(0.72) }}>Weaving a small plan from what you told me…</span>
              ) : (
                <>
                  <span className="font-voice italic" style={{ fontSize: 18, color: dim(0.72), maxWidth: 520 }}>{bridge.summary?.adds ? `${bridge.summary.adds} blocks, woven around your real week — approve to make them real.` : "A gentle start, around the outer world."}</span>
                  {ghost(busy ? "SEALING…" : "SEAL THE WEEK —", () => void sealWeek(), busy)}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {phase === "sealed" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8" style={{ background: "rgba(245,242,234,.97)" }}>
          <div className="mx-contours" style={{ top: "-200px", left: "50%", marginLeft: -450, width: 900, height: 900, opacity: 0.1 }} />
          <h1 className="font-display" style={{ fontWeight: 400, fontSize: 64, color: "#14131A", textAlign: "center" }}>Welcome to Olympus, <span className="italic" style={{ color: GOLD }}>{name || "Ohad"}</span>.</h1>
          <button onClick={() => onComplete?.()} className="font-label" style={{ fontSize: 13, letterSpacing: "0.34em", color: "#14131A", textDecoration: "underline", textDecorationColor: GOLD, textUnderlineOffset: 5, cursor: "pointer" }}>ENTER OLYMPUS —</button>
        </div>
      )}
    </div>
  );
}
