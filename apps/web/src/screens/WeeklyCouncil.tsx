import { useCallback, useEffect, useRef, useState } from "react";
import type { GodId } from "../../../../src/types.js";
import { API_URL, streamChat, type ChatFrame } from "../lib/api.js";
import { GODS_DESIGN, roman, tint } from "../lib/design.js";
import { GodIcon } from "../components/GodIcon.js";

/* ------------------------------------------------------------------ *
 * The Weekly Council — the weekend Rite of Review, held as a real
 * CONVERSATION (not a report). Maxwell opens by reflecting on the week
 * just past in real numbers, then talks it through with Ohad and, when
 * he is ready, offers next week as a proposal he alone seals.
 *
 * Weekend-gated (Sat/Sun); on weekdays the council rests, with a quiet
 * "convene early" for when he wants it anyway. Everything streams live
 * over POST /chat with mode:"council" — nothing here is scripted.
 * ------------------------------------------------------------------ */

const CB = "cubic-bezier(.22,1,.36,1)";
const GOLD = "#C6A15B";
const GOLD_LIGHT = "#E8C87E";
const INK = "#EDE6D6";
const VOID = "#0B0A10";
const PANEL = "#15141B";

const LIVE_GIF: Record<GodId, string> = {
  zeus: "zeus-live.gif",
  athena: "athena-nike-live.gif",
  apollo: "apollo-laurel-live.gif",
  hermes: "hermes-live.gif",
  asclepius: "asclepius-live.gif",
  hestia: "hestia-live.gif",
};

let _seq = 0;
const uid = (): string => `w${_seq++}`;

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/* --------------------------- small pieces ------------------------- */

/** Round portrait; falls back to a dark marble plate + icon on 404. */
function Portrait({ god, size, ring }: { god: GodId; size: number; ring?: boolean }) {
  const [failed, setFailed] = useState(false);
  const d = GODS_DESIGN[god];
  const ringStyle = ring ? { boxShadow: `0 0 0 2px ${tint(d.rgb, 0.45)}` } : {};
  if (failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, ${tint(d.rgb, 0.22)}, rgba(11,10,16,.7))`,
          border: `1px solid ${tint(d.rgb, 0.4)}`,
          ...ringStyle,
        }}
      >
        <GodIcon icon={d.icon} color={d.hue} size={Math.round(size * 0.46)} />
      </div>
    );
  }
  return (
    <img
      src={`/assets/${LIVE_GIF[god]}`}
      alt={d.name}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", ...ringStyle }}
    />
  );
}

/** Streamed text in 3-word groups (matches the council's cadence). */
function TokenGroups({ text, italic = false, size = 16, color = INK }: { text: string; italic?: boolean; size?: number; color?: string }) {
  const words = text.trim().length ? text.trim().split(/\s+/) : [];
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += 3) groups.push(words.slice(i, i + 3).join(" ") + " ");
  return (
    <p
      style={{
        margin: 0,
        fontSize: size,
        lineHeight: italic ? 1.6 : 1.75,
        color,
        maxWidth: "58ch",
        fontFamily: italic ? "'Cormorant Garamond',Georgia,serif" : "'Schibsted Grotesk',sans-serif",
        fontStyle: italic ? "italic" : undefined,
      }}
    >
      {groups.map((g, i) => (
        <span key={i} style={{ opacity: 0, animation: `mxToken .8s ${CB} ${i * 0.02}s both` }}>
          {g}
        </span>
      ))}
    </p>
  );
}

function MaxwellHead() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Portrait god="zeus" size={40} />
      <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".32em", color: GOLD }}>MAXWELL</span>
    </div>
  );
}

/** A god steps forward — hue-tinted passage. */
function StepForward({ god, text }: { god: GodId; text: string }) {
  const d = GODS_DESIGN[god];
  return (
    <div
      style={{
        marginLeft: 52,
        background: tint(d.rgb, 0.08),
        borderTop: `1px solid ${tint(d.rgb, 0.4)}`,
        borderBottom: `1px solid ${tint(d.rgb, 0.4)}`,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Portrait god={god} size={34} ring />
        <span
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 10,
            letterSpacing: ".3em",
            color: d.hue,
            background: tint(d.rgb, 0.12),
            border: `1px solid ${tint(d.rgb, 0.35)}`,
            padding: "5px 11px",
          }}
        >
          {d.name} — STEPS FORWARD
        </span>
      </div>
      <TokenGroups text={text} italic size={19} color={INK} />
    </div>
  );
}

function ConsultedLine({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, animation: `mxRise .8s ${CB} both` }}>
      <div style={{ width: 5, height: 5, transform: "rotate(45deg)", background: GOLD }} />
      <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".28em", color: tint("237,230,214", 0.55) }}>
        {text}
      </span>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        alignSelf: "flex-end",
        maxWidth: "46ch",
        background: "#1E1C25",
        border: "1px solid rgba(237,230,214,.12)",
        borderRadius: 2,
        padding: "14px 18px",
        fontSize: 15,
        lineHeight: 1.65,
        color: "rgba(237,230,214,.9)",
        fontFamily: "'Schibsted Grotesk',sans-serif",
        animation: `mxRise .9s ${CB} both`,
      }}
    >
      {text}
    </div>
  );
}

/* --------------------------- proposal card ------------------------ */

interface ProposalDetail {
  ok: boolean;
  status?: string;
  diff?: {
    adds: Array<{ godId: GodId; title: string; start: string; end: string }>;
    moves: Array<{ title: string; godId: GodId | null; toStart: string; toEnd: string }>;
    deletes: Array<{ title: string; godId: GodId | null }>;
  };
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${wd} ${hh}:${mm}`;
}

/** The next-week proposal — real rows from GET /proposals/:id; APPROVE weaves
 *  it into the Loom through the human-gated approval path. */
function CouncilProposal({ pid }: { pid: string }) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [state, setState] = useState<"open" | "sealing" | "sealed">("open");

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/proposals/${pid}`)
      .then((r) => r.json())
      .then((d: ProposalDetail) => {
        if (alive) setDetail(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pid]);

  const approve = async () => {
    setState("sealing");
    try {
      const r = await fetch(`${API_URL}/proposals/${pid}/approve`, { method: "POST" });
      const j = (await r.json()) as { ok?: boolean };
      setState(j.ok === false ? "open" : "sealed");
    } catch {
      setState("open");
    }
  };

  const rows: Array<{ sign: string; rgb: string; label: string; when: string }> = [];
  if (detail?.diff) {
    for (const a of detail.diff.adds)
      rows.push({ sign: "+", rgb: GODS_DESIGN[a.godId]?.rgb ?? "198,161,91", label: `ADD — ${a.title.toUpperCase()}`, when: fmtWhen(a.start) });
    for (const m of detail.diff.moves)
      rows.push({ sign: "→", rgb: "124,140,166", label: `MOVE — ${m.title.toUpperCase()}`, when: fmtWhen(m.toStart) });
    for (const d of detail.diff.deletes)
      rows.push({ sign: "−", rgb: "138,133,122", label: `REMOVE — ${d.title.toUpperCase()}`, when: "—" });
  }
  const already = detail?.status === "applied";

  return (
    <div
      style={{
        marginLeft: 52,
        maxWidth: 560,
        background: PANEL,
        border: `1px solid ${state === "sealed" || already ? tint("198,161,91", 0.6) : "rgba(237,230,214,.16)"}`,
        borderRadius: 2,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color .8s",
        animation: `mxRise 1s ${CB} both`,
        boxShadow: "0 40px 90px -50px rgba(0,0,0,.8)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".3em", color: GOLD }}>
          NEXT WEEK — THE COUNCIL PROPOSES
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "'Fraunces',Georgia,serif", fontStyle: "italic", fontSize: 14, color: tint("237,230,214", 0.5) }}>
          {rows.length} change{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {!detail && (
        <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 15, color: tint("237,230,214", 0.5) }}>
          drawing up the week…
        </span>
      )}

      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            background: tint(r.rgb, 0.08),
            border: `1px solid ${tint(r.rgb, 0.35)}`,
            borderRadius: 2,
            padding: "11px 14px",
          }}
        >
          <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 16, color: `rgb(${r.rgb})` }}>{r.sign}</span>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".22em", color: INK }}>{r.label}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: tint("237,230,214", 0.5) }}>{r.when}</span>
        </div>
      ))}

      {state !== "sealed" && !already ? (
        <button
          type="button"
          onClick={() => void approve()}
          disabled={!detail || state === "sealing"}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = GOLD;
            e.currentTarget.style.color = VOID;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = GOLD_LIGHT;
          }}
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            fontFamily: "'Cormorant SC',serif",
            fontSize: 12,
            letterSpacing: ".3em",
            color: GOLD_LIGHT,
            background: "transparent",
            border: `1px solid ${GOLD}`,
            padding: "13px 26px",
            borderRadius: 2,
            cursor: !detail || state === "sealing" ? "default" : "pointer",
            opacity: !detail || state === "sealing" ? 0.5 : 1,
            transition: `all .7s ${CB}`,
          }}
        >
          {state === "sealing" ? "WEAVING…" : "SEAL NEXT WEEK —"}
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <div style={{ width: 6, height: 6, background: GOLD_LIGHT, transform: "rotate(45deg)" }} />
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".28em", color: GOLD_LIGHT }}>
            SEALED — WOVEN INTO THE LOOM
          </span>
        </div>
      )}
    </div>
  );
}

/* --------------------------- conversation ------------------------- */

type LiveEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "voice"; id: string; god: GodId; text: string }
  | { kind: "consulted"; id: string; text: string }
  | { kind: "proposal"; id: string; pid: string };

function LiveEntryView({ entry }: { entry: LiveEntry }) {
  if (entry.kind === "user") return <UserBubble text={entry.text} />;
  if (entry.kind === "consulted") return <ConsultedLine text={entry.text} />;
  if (entry.kind === "proposal") return <CouncilProposal pid={entry.pid} />;
  if (entry.god === "zeus") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: `mxRise .9s ${CB} both` }}>
        <MaxwellHead />
        <div style={{ marginLeft: 52 }}>
          <TokenGroups text={entry.text} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ animation: `mxRise 1s ${CB} both` }}>
      <StepForward god={entry.god} text={entry.text} />
    </div>
  );
}

/* ------------------------------ screen ---------------------------- */

export function WeeklyCouncil() {
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const [entered, setEntered] = useState(isWeekend);

  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [inputFocus, setInputFocus] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef<string | null>(null);
  const currentGod = useRef<GodId>("zeus");
  const started = useRef(false);

  const setStatus = (v: string | null) => {
    statusRef.current = v;
    setStatusText(v);
  };

  const scrollDown = () =>
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });

  const onFrame = (frame: ChatFrame) => {
    switch (frame.type) {
      case "session":
        sessionId.current = frame.id;
        break;
      case "token": {
        const consult = statusRef.current;
        if (consult) setStatus(null);
        setEntries((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last && last.kind === "voice") {
            copy[copy.length - 1] = { ...last, text: last.text + frame.text };
          } else {
            if (consult) copy.push({ kind: "consulted", id: uid(), text: consult });
            copy.push({ kind: "voice", id: uid(), god: currentGod.current, text: frame.text });
          }
          return copy;
        });
        scrollDown();
        break;
      }
      case "god": {
        const consult = statusRef.current;
        setStatus(null);
        currentGod.current = frame.godId;
        setEntries((prev) => {
          const copy = prev.slice();
          if (consult) copy.push({ kind: "consulted", id: uid(), text: consult });
          copy.push({ kind: "voice", id: uid(), god: frame.godId, text: "" });
          return copy;
        });
        scrollDown();
        break;
      }
      case "status":
        setStatus(frame.text.toUpperCase());
        break;
      case "tool_start":
        setStatus("CONSULTING THE OUTER WORLD…");
        break;
      case "proposal":
        setEntries((prev) => [...prev, { kind: "proposal", id: uid(), pid: frame.id }]);
        scrollDown();
        break;
      case "error":
        setStatus(null);
        break;
      case "done":
      case "__end__":
        setStatus(null);
        setStreaming(false);
        break;
      default:
        break;
    }
  };

  const run = useCallback(async (message: string) => {
    currentGod.current = "zeus";
    setStreaming(true);
    setStatus(entries.length === 0 ? "THE COUNCIL CONVENES…" : "WEIGHING…");
    scrollDown();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat({ message, sessionId: sessionId.current, mode: "council" }, onFrame, ctrl.signal);
    } catch {
      setStatus(null);
      setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  // The council opens the conversation once, on entry.
  useEffect(() => {
    if (!entered || started.current) return;
    started.current = true;
    void run("The weekend council convenes. Open the review of the week just past, then let us design the next together.");
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  const send = () => {
    const message = draft.trim();
    if (!message || streaming) return;
    setDraft("");
    setEntries((prev) => [...prev, { kind: "user", id: uid(), text: message }]);
    scrollDown();
    void run(message);
  };

  /* ----------------------- weekday gate ----------------------- */
  if (!entered) {
    return (
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          background: VOID,
          color: INK,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          textAlign: "center",
          padding: "0 24px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -300,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1100,
            height: 1100,
            background: "url('/assets/contours-ivory.svg') center / contain no-repeat",
            opacity: 0.12,
            animation: "mxSpin 380s linear infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #E8C87E, #C6A15B 62%, #9A7B40)",
            animation: "mxOrb 5.6s ease-in-out infinite",
            opacity: 0.6,
          }}
        />
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".5em", color: GOLD }}>
          THE WEEKLY COUNCIL
        </span>
        <h1 style={{ margin: 0, fontFamily: "'Fraunces',Georgia,serif", fontWeight: 330, fontSize: 52, lineHeight: 1.05, color: INK, maxWidth: "18ch" }}>
          The council convenes on the weekend.
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "44ch",
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontStyle: "italic",
            fontSize: 20,
            lineHeight: 1.6,
            color: tint("237,230,214", 0.6),
          }}
        >
          Through the week the gods keep quiet watch. Come Saturday, Maxwell sends word — and here you sit with the
          council to weigh the week just past and weave the next, together.
        </p>
        <button
          type="button"
          onClick={() => setEntered(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(198,161,91,.1)";
            e.currentTarget.style.borderColor = GOLD;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(198,161,91,.4)";
          }}
          style={{
            marginTop: 8,
            fontFamily: "'Cormorant SC',serif",
            fontSize: 11,
            letterSpacing: ".32em",
            color: GOLD_LIGHT,
            background: "transparent",
            border: "1px solid rgba(198,161,91,.4)",
            padding: "13px 26px",
            borderRadius: 2,
            cursor: "pointer",
            transition: `all .7s ${CB}`,
          }}
        >
          CONVENE EARLY —
        </button>
      </div>
    );
  }

  /* ----------------------- the conversation ----------------------- */
  const weekNum = roman(isoWeek(now));
  const shimmer =
    streaming && statusText ? (
      <div style={{ display: "flex", alignItems: "center", gap: 12, animation: `mxRise .7s ${CB} both` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, animation: "mxOrb 1.6s ease-in-out infinite" }} />
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".3em", color: GOLD, animation: "mxShimmer 2.2s ease-in-out infinite" }}>
          {statusText}
        </span>
      </div>
    ) : null;

  return (
    <div
      data-screen-label="The Weekly Council"
      style={{ position: "relative", height: "100vh", minHeight: 800, display: "flex", flexDirection: "column", background: VOID, color: INK, overflow: "hidden" }}
    >
      {/* Olympus haze */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 460, overflow: "hidden", pointerEvents: "none" }}>
        <img
          src="/assets/olympus.gif"
          alt=""
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.12, filter: "grayscale(.4) brightness(.7)" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(11,10,16,.35), #0B0A10)" }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: -320,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1100,
          height: 1100,
          background: "url('/assets/contours-ivory.svg') center / contain no-repeat",
          opacity: 0.14,
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
          padding: "22px 44px",
          borderBottom: "1px solid rgba(237,230,214,.12)",
          background: "rgba(11,10,16,.55)",
          backdropFilter: "blur(2px)",
        }}
      >
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 14, letterSpacing: ".34em", color: INK }}>THE WEEKLY COUNCIL</span>
        <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 15, color: tint("237,230,214", 0.6) }}>
          we weigh the week, and weave the next — together
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, animation: "mxOrb 4s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".26em", color: tint("237,230,214", 0.75) }}>
            ZEUS PRESIDES — WEEK {weekNum}
          </span>
        </div>
      </div>

      {/* conversation */}
      <div ref={scrollRef} style={{ position: "relative", zIndex: 2, flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 60px", display: "flex", flexDirection: "column", gap: 26 }}>
          {entries.map((e) => (
            <LiveEntryView key={e.id} entry={e} />
          ))}
          {shimmer}
        </div>
      </div>

      {/* input */}
      <div style={{ position: "relative", zIndex: 3, borderTop: "1px solid rgba(237,230,214,.12)", background: "rgba(11,10,16,.75)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, padding: "20px 24px" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            onFocus={() => setInputFocus(true)}
            onBlur={() => setInputFocus(false)}
            placeholder="Speak with the council…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${inputFocus ? GOLD : "rgba(237,230,214,.2)"}`,
              outline: "none",
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: "italic",
              fontSize: 20,
              color: INK,
              padding: "9px 2px",
              caretColor: GOLD,
              transition: "border-color .7s",
            }}
          />
          <button
            type="button"
            onClick={send}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(198,161,91,.1)";
              e.currentTarget.style.borderColor = GOLD;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(198,161,91,.5)";
            }}
            style={{
              fontFamily: "'Cormorant SC',serif",
              fontSize: 11,
              letterSpacing: ".3em",
              color: GOLD_LIGHT,
              background: "transparent",
              border: "1px solid rgba(198,161,91,.5)",
              padding: "12px 22px",
              borderRadius: 2,
              cursor: "pointer",
              transition: `all .7s ${CB}`,
            }}
          >
            SPEAK —
          </button>
        </div>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 14px" }}>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".28em", color: tint("237,230,214", 0.4) }}>
            THE WEEKEND RITE — WHAT YOU SEAL HERE IS WOVEN INTO NEXT WEEK
          </span>
        </div>
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
