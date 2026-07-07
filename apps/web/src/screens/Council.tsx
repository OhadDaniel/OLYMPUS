import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { streamChat, type ChatFrame } from "../lib/api.js";
import { GODS_DESIGN, tint } from "../lib/design.js";
import { GodIcon } from "../components/GodIcon.js";
import type { GodId } from "../../../../src/types.js";

/**
 * The Council — one continuous divine voice. Pixel-faithful port of
 * screens/The Council.dc.html. The scripted opening scene is baked in exactly
 * (copy, colors, animation delays); anything the user *offers* is streamed live
 * through `streamChat`, rendered with the same vocabulary: 3-word `mxToken`
 * groups, the "consulting the outer world…" shimmer, hue-tinted god
 * step-forward passages, and the proposal card.
 */

const CB = "cubic-bezier(0.22,1,0.36,1)";

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

/** A single explicit-delay span (for the baked opening scene). */
function Tok({
  text,
  delay,
  color,
}: {
  text: string;
  delay: number;
  color?: string;
}) {
  return (
    <span
      style={{
        opacity: 0,
        animation: `mxToken .8s ${CB} ${delay}s both`,
        color,
      }}
    >
      {text}
    </span>
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

interface ProposalRow {
  sign: string;
  color: string;
  bg: string;
  border: string;
  label: string;
  time: string;
}

const DEFAULT_PROPOSAL_ROWS: ProposalRow[] = [
  {
    sign: "+",
    color: "#4F8C82",
    bg: "rgba(79,140,130,.07)",
    border: "rgba(79,140,130,.35)",
    label: "ADD — RUN",
    time: "Tue 07:00 — 07:45",
  },
  {
    sign: "→",
    color: "#7C8CA6",
    bg: "rgba(124,140,166,.07)",
    border: "rgba(124,140,166,.35)",
    label: "MOVE — DEEP WORK",
    time: "Thu 09:00 — 12:00",
  },
];

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

function ProposalCard({
  numeral = "№ 12",
  rows = DEFAULT_PROPOSAL_ROWS,
  delay = 0,
}: {
  numeral?: string;
  rows?: ProposalRow[];
  delay?: number;
}) {
  const [state, setState] = useState<"open" | "sealed" | "editing">("open");
  const border = state === "sealed" ? "rgba(198,161,91,.6)" : "#D8D0C0";

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
        animation: `mxRise 1s ${CB} ${delay}s both`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "'Cormorant SC',serif",
            fontSize: 10,
            letterSpacing: ".3em",
            color: "#8A857A",
          }}
        >
          PROPOSAL — THE COUNCIL
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "'Fraunces',Georgia,serif",
            fontStyle: "italic",
            fontSize: 14,
            color: "#C6A15B",
          }}
        >
          {numeral}
        </span>
      </div>

      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            background: r.bg,
            border: `1px solid ${r.border}`,
            borderRadius: 2,
            padding: "11px 14px",
          }}
        >
          <span
            style={{
              fontFamily: "'Fraunces',Georgia,serif",
              fontSize: 16,
              color: r.color,
            }}
          >
            {r.sign}
          </span>
          <span
            style={{
              fontFamily: "'Cormorant SC',serif",
              fontSize: 11,
              letterSpacing: ".22em",
            }}
          >
            {r.label}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#8A857A" }}>
            {r.time}
          </span>
        </div>
      ))}

      {state === "open" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 4,
          }}
        >
          <GhostButton
            label="APPROVE —"
            onClick={() => setState("sealed")}
            color="#C6A15B"
            borderColor="rgba(198,161,91,.5)"
            hoverColor="#C6A15B"
            hoverBorder="#C6A15B"
            hoverBg="rgba(198,161,91,.1)"
          />
          <GhostButton
            label="EDIT"
            onClick={() => setState("editing")}
            color="#8A857A"
            borderColor="#D8D0C0"
            hoverColor="#4A4740"
            hoverBorder="#8A857A"
            hoverBg="transparent"
          />
        </div>
      )}

      {state === "sealed" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              background: "#C6A15B",
              transform: "rotate(45deg)",
            }}
          />
          <span
            style={{
              fontFamily: "'Cormorant SC',serif",
              fontSize: 11,
              letterSpacing: ".28em",
              color: "#C6A15B",
            }}
          >
            SEALED — WOVEN INTO THE LOOM
          </span>
        </div>
      )}

      {state === "editing" && (
        <span
          style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontStyle: "italic",
            fontSize: 15,
            color: "#8A857A",
          }}
        >
          Amendments open in the Loom — drag the blocks where you will.
        </span>
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
    return (
      <ProposalCard numeral="№ —" />
    );
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
      {/* keyframes the prototype defined locally (not in the global catalog) */}
      <style>{`
        @keyframes mxFadeOut { to { opacity: 0; } }
        @keyframes mxSlideIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes mxRingTeal { 0% { box-shadow: 0 0 0 2px rgba(79,140,130,.55); } 50% { box-shadow: 0 0 0 9px rgba(79,140,130,.1); } 100% { box-shadow: 0 0 0 2px rgba(79,140,130,.55); } }
      `}</style>

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
            opacity: 0.35,
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
            ZEUS PRESIDES — WEEK XXVIII · THU
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
          {/* ── baked opening scene ─────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              animation: `mxRise .8s ${CB} .2s both`,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#D8D0C0" }} />
            <span
              style={{
                fontFamily: "'Cormorant SC',serif",
                fontSize: 10,
                letterSpacing: ".32em",
                color: "#8A857A",
              }}
            >
              THURSDAY — THE EIGHTH HOUR
            </span>
            <div style={{ flex: 1, height: 1, background: "#D8D0C0" }} />
          </div>

          <UserBubble
            text="The launch slipped to Thursday. I'm behind, and I haven't run all week."
            delay={0.5}
          />

          <ConsultedLine
            text="CONSULTED THE OUTER WORLD — CALENDAR · MAIL · 14 THREADS"
            delay={1}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              animation: `mxRise .7s ${CB} 1.2s both, mxFadeOut .6s 2.6s forwards`,
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
              CONSULTING THE OUTER WORLD…
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              animation: `mxRise .9s ${CB} 1.8s both`,
            }}
          >
            <MaxwellHead />
            <p
              style={{
                margin: "0 0 0 52px",
                fontSize: 16,
                lineHeight: 1.75,
                color: "#14131A",
                maxWidth: "56ch",
              }}
            >
              <Tok text="Then we move the wall, " delay={2.2} />
              <Tok text="not the runner. " delay={2.36} />
              <Tok text="Thursday is workable — " delay={2.52} />
              <Tok text="two deep-work mornings " delay={2.68} />
              <Tok text="stand open before the gate. " delay={2.84} />
              <Tok text="I will hold them. " delay={3} />
              <Tok text="But hear me: " delay={3.16} />
              <Tok text="the body pays " delay={3.32} />
              <Tok text="your interest first, " delay={3.48} />
              <Tok text="and it has gone unpaid " delay={3.64} />
              <Tok text="four days now. " delay={3.8} />
              <Tok text="Asclepius —" delay={3.96} />
            </p>
          </div>

          {/* asclepius step-forward (baked) */}
          <div
            style={{
              marginLeft: 52,
              background: "rgba(79,140,130,.07)",
              borderTop: "1px solid rgba(79,140,130,.4)",
              borderBottom: "1px solid rgba(79,140,130,.4)",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              animation: `mxRise 1s ${CB} 4.5s both`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  borderRadius: "50%",
                  animation: "mxRingTeal 1.8s ease-in-out 4.7s 2",
                }}
              >
                <Avatar god="asclepius" size={34} />
              </div>
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 10,
                  letterSpacing: ".3em",
                  color: "#4F8C82",
                  background: "rgba(79,140,130,.1)",
                  border: "1px solid rgba(79,140,130,.35)",
                  padding: "5px 11px",
                  animation: `mxSlideIn .9s ${CB} 4.8s both`,
                }}
              >
                ASCLEPIUS — STEPS FORWARD
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontStyle: "italic",
                fontSize: 19,
                lineHeight: 1.6,
                color: "#14131A",
              }}
            >
              <Tok text="Three dawns this week " delay={5.1} />
              <Tok text="belong to the road. " delay={5.32} />
              <Tok text="I have held Tuesday, " delay={5.54} />
              <Tok text="seven o'clock — " delay={5.76} />
              <Tok text="say yes, and it is stone." delay={5.98} />
            </p>
          </div>

          <ProposalCard delay={6.6} />

          <UserBubble
            text="Approve the run. Keep Friday night free for Maria."
            delay={7.2}
          />

          <ConsultedLine
            text="CONSULTED — TELEGRAM · ONE PROMISE FOUND"
            delay={7.7}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              animation: `mxRise .9s ${CB} 8s both`,
            }}
          >
            <MaxwellHead />
            <p
              style={{
                margin: "0 0 0 52px",
                fontSize: 16,
                lineHeight: 1.75,
                color: "#14131A",
                maxWidth: "56ch",
              }}
            >
              <Tok text="Done. " delay={8.3} />
              <Tok text="The run is stone; " delay={8.48} />
              <Tok text="Friday dusk stays yours — " delay={8.66} />
              <Tok text="Hestia " delay={8.84} color="#E2823C" />
              <Tok text="will guard the table." delay={9.02} />
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              animation: `mxRise .9s ${CB} 9.8s both`,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#D8D0C0" }} />
            <span
              style={{
                fontFamily: "'Cormorant SC',serif",
                fontSize: 9,
                letterSpacing: ".3em",
                color: "#8A857A",
              }}
            >
              SEALED — THU 21:04 · THE LOOM UPDATED
            </span>
            <div style={{ flex: 1, height: 1, background: "#D8D0C0" }} />
          </div>

          {/* ── live turns ──────────────────────────────────────── */}
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
