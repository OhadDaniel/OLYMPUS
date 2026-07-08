import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { API_URL, streamChat, type ChatFrame } from "../lib/api.js";
import { GODS_DESIGN, roman, tint } from "../lib/design.js";
import { GodIcon } from "../components/GodIcon.js";
import type { GodId } from "../../../../src/types.js";

/**
 * The Council — one continuous divine voice. The conversation starts EMPTY:
 * a mythic empty state waits until the user speaks, and everything after is
 * streamed live through `streamChat` — nothing is scripted or baked. Live turns
 * are rendered with the design vocabulary: 3-word `mxToken` groups, the
 * "consulting the outer world…" shimmer, hue-tinted god step-forward passages,
 * and the proposal card.
 */

const CB = "cubic-bezier(0.22,1,0.36,1)";

// The council's live "presiding" label — real week number + weekday, no fixtures.
function presidingLabel(): string {
  const now = new Date();
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getDay()];
  return `ZEUS PRESIDES — WEEK ${roman(week)} · ${wd}`;
}

// Live GIF filenames per god (404 gracefully → marble icon fallback).
const LIVE_GIF: Record<GodId, string> = {
  zeus: "zeus-live.gif",
  athena: "athena-nike-live.gif",
  apollo: "apollo-laurel-live.gif",
  hermes: "hermes-live.gif",
  asclepius: "asclepius-live.gif",
  hestia: "hestia-live.gif",
};

let _seq = 0;
const uid = (): string => `e${_seq++}`;

// ── Small building blocks ───────────────────────────────────────────────────

/** A round avatar; falls back to a marble icon circle when the gif is absent. */
function Avatar({
  god,
  size,
  ring,
}: {
  god: GodId;
  size: number;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const d = GODS_DESIGN[god];
  const ringStyle: CSSProperties = ring
    ? { boxShadow: `0 0 0 2px ${tint(d.rgb, 0.4)}` }
    : {};

  if (!failed) {
    return (
      <img
        src={`/assets/${LIVE_GIF[god]}`}
        alt={d.name}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: god === "zeus" ? "1px solid #D8D0C0" : undefined,
          ...ringStyle,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #ECE7DB, #D8D0C0)",
        border: "1px solid #D8D0C0",
        ...ringStyle,
      }}
    >
      <GodIcon icon={d.icon} color={d.hue} size={Math.round(size * 0.46)} />
    </div>
  );
}

/** A decorative frieze figure — hides itself if the gif is missing. */
function FriezeImg({
  god,
  height,
  marginTop,
  brightness,
}: {
  god: GodId;
  height: number;
  marginTop: number;
  brightness: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div style={{ width: 1, height }} />;
  return (
    <img
      src={`/assets/${LIVE_GIF[god]}`}
      alt=""
      onError={() => setFailed(true)}
      style={{
        height,
        marginTop,
        mixBlendMode: "multiply",
        filter: `grayscale(1) brightness(${brightness})`,
      }}
    />
  );
}

/** Text broken into animated 3-word groups (matches the prototype grouping). */
function TokenGroups({
  text,
  base = 0,
  step = 0,
  italic = false,
  size = 16,
  color = "#14131A",
}: {
  text: string;
  base?: number;
  step?: number;
  italic?: boolean;
  size?: number;
  color?: string;
}) {
  const words = text.trim().length ? text.trim().split(/\s+/) : [];
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    groups.push(words.slice(i, i + 3).join(" ") + " ");
  }
  return (
    <p
      style={{
        margin: 0,
        fontSize: size,
        lineHeight: italic ? 1.6 : 1.75,
        color,
        maxWidth: "56ch",
        fontFamily: italic
          ? "'Cormorant Garamond',Georgia,serif"
          : undefined,
        fontStyle: italic ? "italic" : undefined,
      }}
    >
      {groups.map((g, i) => (
        <span
          key={i}
          style={{
            opacity: 0,
            animation: `mxToken .8s ${CB} ${base + i * step}s both`,
          }}
        >
          {g}
        </span>
      ))}
    </p>
  );
}

/** A completed "CONSULTED —" diamond marker line. */
function ConsultedLine({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation: `mxRise .8s ${CB} ${delay}s both`,
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          transform: "rotate(45deg)",
          background: "#C6A15B",
        }}
      />
      <span
        style={{
          fontFamily: "'Cormorant SC',serif",
          fontSize: 10,
          letterSpacing: ".28em",
          color: "#8A857A",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** A user's offering bubble. */
function UserBubble({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <div
      style={{
        alignSelf: "flex-end",
        maxWidth: "46ch",
        background: "#ECE7DB",
        borderRadius: 2,
        padding: "14px 18px",
        fontSize: 15,
        lineHeight: 1.65,
        color: "#4A4740",
        animation: `mxRise .9s ${CB} ${delay}s both`,
      }}
    >
      {text}
    </div>
  );
}

/** Maxwell's (Zeus) top-level nameplate + voice header row. */
function MaxwellHead() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar god="zeus" size={40} />
      <span
        style={{
          fontFamily: "'Cormorant SC',serif",
          fontSize: 12,
          letterSpacing: ".32em",
          color: "#C6A15B",
        }}
      >
        MAXWELL
      </span>
    </div>
  );
}

// ── Proposal card ───────────────────────────────────────────────────────────

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

function GhostButton({
  label,
  onClick,
  color,
  borderColor,
  hoverColor,
  hoverBorder,
  hoverBg,
  letterSpacing = ".26em",
  padding = "10px 18px",
}: {
  label: string;
  onClick: () => void;
  color: string;
  borderColor: string;
  hoverColor: string;
  hoverBorder: string;
  hoverBg: string;
  letterSpacing?: string;
  padding?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Cormorant SC',serif",
        fontSize: 11,
        letterSpacing,
        color: hover ? hoverColor : color,
        background: hover ? hoverBg : "transparent",
        border: `1px solid ${hover ? hoverBorder : borderColor}`,
        padding,
        borderRadius: 2,
        cursor: "pointer",
        transition: `all .7s ${CB}`,
      }}
    >
      {label}
    </button>
  );
}

function ProposalCard({ pid }: { pid: string }) {
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

  const rows: Array<{ sign: string; rgb: string; label: string; time: string }> = [];
  if (detail?.diff) {
    for (const a of detail.diff.adds)
      rows.push({ sign: "+", rgb: GODS_DESIGN[a.godId]?.rgb ?? "198,161,91", label: `ADD — ${a.title.toUpperCase()}`, time: fmtWhen(a.start) });
    for (const m of detail.diff.moves)
      rows.push({ sign: "→", rgb: "124,140,166", label: `MOVE — ${m.title.toUpperCase()}`, time: fmtWhen(m.toStart) });
    for (const d of detail.diff.deletes)
      rows.push({ sign: "−", rgb: "138,133,122", label: `REMOVE — ${d.title.toUpperCase()}`, time: "—" });
  }
  const already = detail?.status === "applied";
  const sealed = state === "sealed" || already;
  const border = sealed ? "rgba(198,161,91,.6)" : "#D8D0C0";

  return (
    <div
      style={{
        marginLeft: 52,
        maxWidth: 540,
        background: "#FBF9F4",
        border: `1px solid ${border}`,
        borderRadius: 2,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color .8s",
        animation: `mxRise 1s ${CB} both`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".3em", color: "#8A857A" }}>
          PROPOSAL — THE COUNCIL
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "'Fraunces',Georgia,serif", fontStyle: "italic", fontSize: 14, color: "#C6A15B" }}>
          {rows.length} change{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {!detail && (
        <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 15, color: "#8A857A" }}>
          drawing up the change…
        </span>
      )}

      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            background: `rgba(${r.rgb},.07)`,
            border: `1px solid rgba(${r.rgb},.35)`,
            borderRadius: 2,
            padding: "11px 14px",
          }}
        >
          <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 16, color: `rgb(${r.rgb})` }}>{r.sign}</span>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".22em" }}>{r.label}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#8A857A" }}>{r.time}</span>
        </div>
      ))}

      {!sealed ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
          <GhostButton
            label={state === "sealing" ? "WEAVING…" : "APPROVE —"}
            onClick={() => {
              if (detail && state !== "sealing") void approve();
            }}
            color="#C6A15B"
            borderColor="rgba(198,161,91,.5)"
            hoverColor="#C6A15B"
            hoverBorder="#C6A15B"
            hoverBg="rgba(198,161,91,.1)"
          />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <div style={{ width: 6, height: 6, background: "#C6A15B", transform: "rotate(45deg)" }} />
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".28em", color: "#C6A15B" }}>
            SEALED — WOVEN INTO THE LOOM
          </span>
        </div>
      )}
    </div>
  );
}

// ── Live conversation model ─────────────────────────────────────────────────

type LiveEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "voice"; id: string; god: GodId; text: string }
  | { kind: "consulted"; id: string; text: string }
  | { kind: "proposal"; id: string; pid: string };

/** One live-streamed god step-forward passage (hue-tinted block). */
function StepForward({ god, text }: { god: GodId; text: string }) {
  const d = GODS_DESIGN[god];
  return (
    <div
      style={{
        marginLeft: 52,
        background: tint(d.rgb, 0.07),
        borderTop: `1px solid ${tint(d.rgb, 0.4)}`,
        borderBottom: `1px solid ${tint(d.rgb, 0.4)}`,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar god={god} size={34} ring />
        <span
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 10,
            letterSpacing: ".3em",
            color: d.hue,
            background: tint(d.rgb, 0.1),
            border: `1px solid ${tint(d.rgb, 0.35)}`,
            padding: "5px 11px",
          }}
        >
          {d.name} — STEPS FORWARD
        </span>
      </div>
      <TokenGroups text={text} italic size={19} />
    </div>
  );
}

/** Render one live entry with an entrance rise. */
function LiveEntryView({ entry }: { entry: LiveEntry }) {
  if (entry.kind === "user") {
    return <UserBubble text={entry.text} />;
  }
  if (entry.kind === "consulted") {
    return <ConsultedLine text={entry.text} />;
  }
  if (entry.kind === "proposal") {
    return <ProposalCard pid={entry.pid} />;
  }
  // voice
  if (entry.god === "zeus") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: `mxRise .9s ${CB} both`,
        }}
      >
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

/** Mythic empty state — shown until the user first addresses the council. */
function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 20,
        padding: "40px 24px",
        animation: `mxRise 1.1s ${CB} .2s both`,
      }}
    >
      <span
        style={{
          fontFamily: "'Cormorant SC',serif",
          fontSize: 11,
          letterSpacing: ".34em",
          color: "#C6A15B",
        }}
      >
        THE COUNCIL ATTENDS
      </span>
      <h2
        style={{
          margin: 0,
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: 40,
          lineHeight: 1.15,
          color: "#14131A",
        }}
      >
        The council is listening.
      </h2>
      <p
        style={{
          margin: 0,
          maxWidth: "44ch",
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontStyle: "italic",
          fontSize: 19,
          lineHeight: 1.6,
          color: "#8A857A",
        }}
      >
        Address them — Maxwell answers, and the gods step forward when their
        domain is called.
      </p>
    </div>
  );
}

// ── The screen ──────────────────────────────────────────────────────────────

export function Council({
  showFrieze = true,
  showGrain = true,
}: {
  showFrieze?: boolean;
  showGrain?: boolean;
}) {
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

  const setStatus = (v: string | null) => {
    statusRef.current = v;
    setStatusText(v);
  };

  useEffect(() => () => abortRef.current?.abort(), []);

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
            if (consult) {
              copy.push({ kind: "consulted", id: uid(), text: consult });
            }
            copy.push({
              kind: "voice",
              id: uid(),
              god: currentGod.current,
              text: frame.text,
            });
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
          if (consult) {
            copy.push({ kind: "consulted", id: uid(), text: consult });
          }
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
        setEntries((prev) => [
          ...prev,
          { kind: "proposal", id: uid(), pid: frame.id },
        ]);
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

  const send = async () => {
    const message = draft.trim();
    if (!message || streaming) return;
    setDraft("");
    setEntries((prev) => [...prev, { kind: "user", id: uid(), text: message }]);
    currentGod.current = "zeus";
    setStreaming(true);
    setStatus("CONSULTING THE OUTER WORLD…");
    scrollDown();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(
        { message, sessionId: sessionId.current },
        onFrame,
        ctrl.signal,
      );
    } catch {
      setStatus(null);
      setStreaming(false);
    }
  };

  // The always-shimmering live status line.
  const shimmer: ReactNode =
    streaming && statusText ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          animation: `mxRise .7s ${CB} both`,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#C6A15B",
            animation: "mxOrb 1.6s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 11,
            letterSpacing: ".3em",
            color: "#C6A15B",
            animation: "mxShimmer 2.2s ease-in-out infinite",
          }}
        >
          {statusText}
        </span>
      </div>
    ) : null;

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        minHeight: 800,
        display: "flex",
        flexDirection: "column",
        background: "#F5F2EA",
        overflow: "hidden",
      }}
    >
      {/* the five gods, faint in the far background */}
      {showFrieze && (
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "0 7%",
            pointerEvents: "none",
            opacity: 0.12,
          }}
        >
          <FriezeImg god="athena" height={216} marginTop={0} brightness={1.16} />
          <FriezeImg god="asclepius" height={188} marginTop={44} brightness={2.05} />
          <FriezeImg god="hermes" height={206} marginTop={10} brightness={1.16} />
          <FriezeImg god="hestia" height={188} marginTop={48} brightness={2.05} />
          <FriezeImg god="apollo" height={212} marginTop={6} brightness={1.05} />
        </div>
      )}

      {/* rotating contour map */}
      <div
        style={{
          position: "absolute",
          top: -340,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1100,
          height: 1100,
          background: "url('/assets/contours-ink.svg') center / contain no-repeat",
          opacity: 0.35,
          animation: "mxSpin 360s linear infinite",
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
          alignItems: "baseline",
          padding: "22px 44px",
          borderBottom: "1px solid #D8D0C0",
          background: "rgba(245,242,234,.82)",
          backdropFilter: "blur(2px)",
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 14,
            letterSpacing: ".34em",
          }}
        >
          THE COUNCIL
        </span>
        <span
          style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontStyle: "italic",
            fontSize: 15,
            color: "#8A857A",
          }}
        >
          one continuous divine voice — not a chatbot
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#C6A15B",
              animation: "mxOrb 4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "'Cormorant SC',serif",
              fontSize: 11,
              letterSpacing: ".26em",
              color: "#4A4740",
            }}
          >
            {presidingLabel()}
          </span>
        </div>
      </div>

      {/* conversation */}
      <div
        ref={scrollRef}
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            padding: "150px 24px 60px",
            display: "flex",
            flexDirection: "column",
            gap: 26,
          }}
        >
          {/* the council waits, empty, until the user speaks */}
          {entries.length === 0 && !streaming && <EmptyState />}

          {/* ── live turns (streamed, never scripted) ───────────── */}
          {entries.map((e) => (
            <LiveEntryView key={e.id} entry={e} />
          ))}

          {shimmer}
        </div>
      </div>

      {/* input bar */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          borderTop: "1px solid #D8D0C0",
          background: "#F5F2EA",
        }}
      >
        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "20px 24px",
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
            onFocus={() => setInputFocus(true)}
            onBlur={() => setInputFocus(false)}
            placeholder="Address the council…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${inputFocus ? "#C6A15B" : "#D8D0C0"}`,
              outline: "none",
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: "italic",
              fontSize: 20,
              color: "#14131A",
              padding: "9px 2px",
              caretColor: "#C6A15B",
              transition: "border-color .7s",
            }}
          />
          <GhostButton
            label="OFFER —"
            onClick={() => void send()}
            color="#C6A15B"
            borderColor="rgba(198,161,91,.5)"
            hoverColor="#C6A15B"
            hoverBorder="#C6A15B"
            hoverBg="rgba(198,161,91,.08)"
            letterSpacing=".3em"
            padding="12px 22px"
          />
        </div>
        <div
          style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 14px" }}
        >
          <span
            style={{
              fontFamily: "'Cormorant SC',serif",
              fontSize: 9,
              letterSpacing: ".28em",
              color: "#8A857A",
            }}
          >
            THE GODS ATTEND, QUIET IN THE MARBLE — SPEAK PLAINLY
          </span>
        </div>
      </div>

      {showGrain && (
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
      )}
    </div>
  );
}
