import { useEffect, useMemo, useRef, useState } from "react";
import { openVeil } from "../lib/api.js";
import type { VeilFrame } from "../lib/types.js";
import { GODS_DESIGN } from "../lib/design.js";
import type { AgentEvent } from "../../../../src/events.js";
import type { RiskClass } from "../../../../src/types.js";

/**
 * Behind the Veil — the engraved terminal.
 *
 * A right-side drawer overlay that subscribes to the global harness event
 * stream (`openVeil`) and engraves each read / write / gate as it happens:
 * risk badges (READ · WRITE · DESTRUCTIVE), a NATIVE/MCP source chip, the gate
 * verdict, skill chips, self-checks as a Momus gate row, and a running token
 * total in the footer. Ported pixel-faithfully from
 * "Behind the Veil.dc.html".
 */

const IVORY = "#EDE6D6";
const GOLD = "#C6A15B";
const GOLD_LIT = "#E8C87E";

const RISK_META: Record<RiskClass, { label: string; color: string }> = {
  read_only: { label: "READ", color: "#7C8CA6" },
  write: { label: "WRITE", color: "#C6A15B" },
  destructive: { label: "DESTRUCTIVE", color: "#E2823C" },
};

/** A single engraved line, derived from one harness AgentEvent. */
interface Row {
  time: string;
  title: string;
  titleColor: string;
  tokens: string;
  risk: string | null;
  riskColor: string;
  src: string | null;
  gate: string | null;
  gateColor: string;
  chips: string;
  destructive: boolean;
  gated: boolean;
}

function clock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Turn a harness event into an engraved row, or null to omit (raw tokens). */
function toRow(frame: VeilFrame): Row | null {
  const e: AgentEvent = frame.event;
  const time = clock(frame.ts);
  const base: Row = {
    time,
    title: "",
    titleColor: IVORY,
    tokens: "",
    risk: null,
    riskColor: "rgba(237,230,214,.4)",
    src: null,
    gate: null,
    gateColor: "rgba(237,230,214,.4)",
    chips: "",
    destructive: false,
    gated: false,
  };

  switch (e.type) {
    case "token":
      return null; // chat content, not a machinery op
    case "god": {
      const g = GODS_DESIGN[e.godId];
      return { ...base, title: `${g.name.toLowerCase()} · steps forward`, titleColor: g.hue, chips: "core.presence" };
    }
    case "status":
      return { ...base, title: e.text, titleColor: "rgba(237,230,214,.72)" };
    case "skill":
      return { ...base, title: `skill · ${e.name}`, titleColor: GOLD_LIT, chips: `L${e.level}` };
    case "tool_start": {
      const meta = e.risk ? RISK_META[e.risk] : null;
      const destructive = e.risk === "destructive";
      return {
        ...base,
        title: e.name,
        titleColor: destructive ? GOLD_LIT : IVORY,
        risk: meta?.label ?? null,
        riskColor: meta?.color ?? "rgba(237,230,214,.4)",
        src: e.source ? e.source.toUpperCase() : null,
        gate: "ALLOWED",
        chips: e.skill ?? "",
        destructive,
      };
    }
    case "tool_gate":
      return {
        ...base,
        title: e.name,
        titleColor: GOLD_LIT,
        gate: "GATED — YOUR SEAL REQUIRED",
        gateColor: GOLD_LIT,
        gated: true,
      };
    case "tool_result":
      return {
        ...base,
        title: e.name,
        titleColor: e.ok ? IVORY : "#E2823C",
        gate: e.ok ? "EXECUTED CLEAN" : "BLOCKED",
        gateColor: e.ok ? "rgba(237,230,214,.4)" : "#E2823C",
      };
    case "self_check": {
      const concerns = e.verdict === "concerns";
      return {
        ...base,
        title: "momus · self-check",
        titleColor: concerns ? GOLD_LIT : IVORY,
        risk: "GATE",
        riskColor: concerns ? GOLD_LIT : "#7C8CA6",
        gate: e.verdict.toUpperCase(),
        gateColor: concerns ? GOLD_LIT : "rgba(237,230,214,.4)",
        chips: `${e.passed}/${e.total}${e.risks.length ? " · " + e.risks.join(" · ") : ""}`,
        gated: concerns,
      };
    }
    case "subagent": {
      const g = GODS_DESIGN[e.godId];
      return { ...base, title: `subagent · ${g.name.toLowerCase()} — ${e.state}`, titleColor: g.hue, chips: e.state };
    }
    case "proposal":
      return {
        ...base,
        title: `proposal · ${e.id}`,
        titleColor: GOLD_LIT,
        gate: "GATED — AWAITS SEAL",
        gateColor: GOLD_LIT,
        gated: true,
      };
    case "usage":
      return {
        ...base,
        title: "usage · counted",
        titleColor: "rgba(237,230,214,.6)",
        tokens: `${(e.totalTokens / 1000).toFixed(1)}k tk`,
      };
    case "done":
      return { ...base, title: "council.rest", titleColor: IVORY, gate: "SEALED", chips: "core.presence" };
    case "error":
      return { ...base, title: `error · ${e.message}`, titleColor: "#E2823C", gate: "HALTED", gateColor: "#E2823C" };
    default:
      return null;
  }
}

interface Totals {
  tokens: number;
  gates: number;
  unsealed: number;
}

function computeTotals(frames: VeilFrame[]): Totals {
  let tokens = 0;
  let gates = 0;
  const gatedNames = new Set<string>();
  const riskByName = new Map<string, RiskClass>();
  let unsealed = 0;
  for (const f of frames) {
    const e = f.event;
    if (e.type === "usage") tokens = Math.max(tokens, e.totalTokens);
    else if (e.type === "tool_gate") {
      gates += 1;
      gatedNames.add(e.name);
    } else if (e.type === "proposal") gates += 1;
    else if (e.type === "tool_start" && e.risk) riskByName.set(e.name, e.risk);
    else if (e.type === "tool_result" && e.ok) {
      const risk = riskByName.get(e.name);
      if ((risk === "write" || risk === "destructive") && !gatedNames.has(e.name)) unsealed += 1;
    }
  }
  return { tokens, gates, unsealed };
}

export function Veil({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [frames, setFrames] = useState<VeilFrame[]>([]);
  const [closeHover, setCloseHover] = useState(false);
  const [replayHover, setReplayHover] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = openVeil((frame) => {
      setFrames((prev) => {
        const next = [...prev, frame];
        return next.length > 250 ? next.slice(-250) : next;
      });
    });
    return unsub;
  }, []);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const f of frames) {
      const r = toRow(f);
      if (r) out.push(r);
    }
    return out;
  }, [frames]);

  const totals = useMemo(() => computeTotals(frames), [frames]);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  const totalsLine = `Σ ${(totals.tokens / 1000).toFixed(1)}K TOKENS · ${totals.gates} GATES HELD · ${totals.unsealed} UNSEALED WRITES`;

  return (
    <>
      {/* dim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(11,10,16,.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .9s cubic-bezier(.22,1,.36,1)",
        }}
      />

      {/* the drawer: engraved terminal */}
      <aside
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          width: 580,
          maxWidth: "92vw",
          background: "#0F0E15",
          borderLeft: "1px solid rgba(198,161,91,.4)",
          boxShadow: "-50px 0 110px rgba(11,10,16,.65)",
          transform: open ? "translateX(0)" : "translateX(104%)",
          transition: "transform .95s cubic-bezier(.22,1,.36,1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* grain */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "url('/assets/grain.svg')",
            backgroundSize: "280px 280px",
            opacity: 0.06,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />

        {/* header */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "24px 28px",
            borderBottom: "1px solid rgba(237,230,214,.1)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: GOLD,
              animation: "mxOrb 2.6s ease-in-out infinite",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".4em", color: GOLD }}>
              BEHIND THE VEIL
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "rgba(237,230,214,.45)" }}>
              the machinery, engraved — live
            </span>
          </div>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              marginLeft: "auto",
              fontFamily: "'Cormorant SC',serif",
              fontSize: 13,
              color: closeHover ? GOLD_LIT : "rgba(237,230,214,.5)",
              background: "transparent",
              border: `1px solid ${closeHover ? "rgba(198,161,91,.5)" : "rgba(237,230,214,.18)"}`,
              width: 32,
              height: 32,
              borderRadius: 2,
              cursor: "pointer",
              transition: "all .6s cubic-bezier(.22,1,.36,1)",
            }}
          >
            ×
          </button>
        </div>

        {/* stream */}
        <div ref={streamRef} style={{ position: "relative", flex: 1, overflowY: "auto" }}>
          {rows.length === 0 ? (
            <div
              style={{
                padding: "40px 24px",
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11,
                lineHeight: 1.7,
                color: "rgba(237,230,214,.4)",
              }}
            >
              The harness is quiet. Speak to the Council and the machinery wakes — each read, write and gate engraved here as it happens.
            </div>
          ) : (
            rows.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: "13px 24px",
                  borderBottom: "1px solid rgba(237,230,214,.07)",
                  background: e.destructive ? "rgba(198,161,91,.09)" : "transparent",
                  borderTop: e.destructive ? "1px solid rgba(198,161,91,.5)" : "1px solid transparent",
                  animation: e.destructive
                    ? "mxRowIn .8s cubic-bezier(.22,1,.36,1) both, mxPulseGold 3.2s ease-in-out .8s infinite"
                    : "mxRowIn .8s cubic-bezier(.22,1,.36,1) both",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "rgba(237,230,214,.4)" }}>
                    {e.time}
                  </span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: e.titleColor,
                    }}
                  >
                    {e.title}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 10,
                      color: "rgba(237,230,214,.45)",
                    }}
                  >
                    {e.tokens}
                  </span>
                </div>
                {(e.risk || e.src || e.gate || e.chips) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7, flexWrap: "wrap" }}>
                    {e.risk && (
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 8.5,
                          letterSpacing: ".1em",
                          color: e.riskColor,
                          border: `1px solid ${e.riskColor}66`,
                          padding: "3px 7px",
                          borderRadius: 2,
                        }}
                      >
                        {e.risk}
                      </span>
                    )}
                    {e.src && (
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 8.5,
                          letterSpacing: ".1em",
                          color: "rgba(237,230,214,.55)",
                          border: "1px solid rgba(237,230,214,.2)",
                          padding: "3px 7px",
                          borderRadius: 2,
                        }}
                      >
                        {e.src}
                      </span>
                    )}
                    {e.gate && (
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 9.5,
                          letterSpacing: ".08em",
                          color: e.gateColor,
                        }}
                      >
                        {e.gate}
                      </span>
                    )}
                    {e.chips && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 9,
                          color: "rgba(237,230,214,.38)",
                        }}
                      >
                        {e.chips}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div style={{ height: 16 }} />
        </div>

        {/* footer */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 24px",
            borderTop: "1px solid rgba(237,230,214,.12)",
          }}
        >
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "rgba(237,230,214,.55)" }}>
            {totalsLine}
          </span>
          <button
            onClick={() => setFrames([])}
            onMouseEnter={() => setReplayHover(true)}
            onMouseLeave={() => setReplayHover(false)}
            style={{
              marginLeft: "auto",
              fontFamily: "'Cormorant SC',serif",
              fontSize: 10,
              letterSpacing: ".28em",
              color: GOLD,
              background: replayHover ? "rgba(198,161,91,.08)" : "transparent",
              border: "1px solid rgba(198,161,91,.45)",
              padding: "9px 15px",
              borderRadius: 2,
              cursor: "pointer",
              transition: "all .7s cubic-bezier(.22,1,.36,1)",
            }}
          >
            ENGRAVE AGAIN —
          </button>
        </div>
      </aside>
    </>
  );
}
