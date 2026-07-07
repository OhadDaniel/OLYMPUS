import { useEffect, useRef, useState } from "react";
import { openVeil } from "../lib/api.js";
import type { VeilFrame } from "../lib/types.js";
import { GODS } from "../../../../src/pantheon.js";

const RISK_COLOR: Record<string, string> = {
  read_only: "#4F8C82",
  write: "#C6A15B",
  destructive: "#c96b6b",
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="rounded px-1 py-[1px] text-[10px] uppercase tracking-wider"
      style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}
    >
      {text}
    </span>
  );
}

function shortRun(runId: string): string {
  return runId.slice(-4);
}

function FrameRow({ frame }: { frame: VeilFrame }) {
  const e = frame.event;
  const run = <span className="text-ink-3">#{shortRun(frame.runId)}</span>;

  switch (e.type) {
    case "tool_start":
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {run}
          <span className="text-ink-2">→ tool</span>
          <span className="text-ink">{e.name}</span>
          {e.risk && <Badge text={e.risk.replace("_", " ")} color={RISK_COLOR[e.risk] ?? "#726c64"} />}
          {e.source && <Badge text={e.source} color={e.source === "mcp" ? "#7C8CA6" : "#726c64"} />}
          {e.skill && <Badge text={`skill:${e.skill}`} color="#E8A33D" />}
        </div>
      );
    case "tool_gate":
      return (
        <div className="flex items-center gap-1.5">
          {run}
          <Badge text="⛔ gated" color="#c96b6b" />
          <span className="text-ink-2">{e.name} — awaiting approval</span>
        </div>
      );
    case "tool_result":
      return (
        <div className="flex items-center gap-1.5">
          {run}
          <span className="text-ink-2">← {e.name}</span>
          <Badge text={e.ok ? "ok" : "blocked"} color={e.ok ? "#4F8C82" : "#c96b6b"} />
        </div>
      );
    case "self_check":
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {run}
            <Badge text={`momus: ${e.verdict}`} color={e.verdict === "clear" ? "#4F8C82" : "#C6A15B"} />
            <span className="text-ink-3">{e.passed}/{e.total} checks</span>
          </div>
          {e.risks.map((r, i) => (
            <span key={i} className="pl-6 text-[10px] text-ink-3">· {r}</span>
          ))}
        </div>
      );
    case "skill":
      return (
        <div className="flex items-center gap-1.5">
          {run}
          <Badge text={`skill L${e.level}`} color="#E8A33D" />
          <span className="text-ink">{e.name}</span>
        </div>
      );
    case "god":
      return (
        <div className="flex items-center gap-1.5">
          {run}
          <span style={{ color: GODS[e.godId].accent }}>◆ {GODS[e.godId].name} steps forward</span>
        </div>
      );
    case "subagent":
      return (
        <div className="flex items-center gap-1.5">
          {run}
          <span style={{ color: GODS[e.godId].accent }}>{GODS[e.godId].name}</span>
          <Badge text={e.state} color="#7C8CA6" />
        </div>
      );
    case "status":
      return <div className="flex items-center gap-1.5">{run}<span className="text-ink-3 italic">{e.text}</span></div>;
    case "proposal":
      return <div className="flex items-center gap-1.5">{run}<Badge text="proposal" color="#C6A15B" /><span className="text-ink-3">{e.id}</span></div>;
    case "usage":
      return <div className="flex items-center gap-1.5">{run}<span className="text-ink-3">usage {e.totalTokens} tok</span></div>;
    case "done":
      return <div className="flex items-center gap-1.5">{run}<Badge text="done" color="#4F8C82" /></div>;
    case "error":
      return <div className="flex items-center gap-1.5">{run}<Badge text="error" color="#c96b6b" /><span className="text-ink-3">{e.message}</span></div>;
    default:
      return null; // tokens are chat content, not harness ops — omit from the Veil
  }
}

export function Veil({ open }: { open: boolean }) {
  const [frames, setFrames] = useState<VeilFrame[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = openVeil((frame) => {
      setFrames((prev) => {
        const next = [...prev, frame];
        return next.length > 250 ? next.slice(-250) : next;
      });
    });
    return close;
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [frames]);

  return (
    <aside
      className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-hairline bg-s1/95 backdrop-blur transition-transform duration-300"
      style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <span className="font-label uppercase tracking-[0.2em] text-gold">Behind the Veil</span>
        <span className="text-[10px] text-ink-3">⌘. to toggle</span>
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
        {frames.length === 0 ? (
          <p className="text-ink-3">The harness is quiet. Speak to the Council and the machinery wakes.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {frames.map((f, i) => (
              <FrameRow key={i} frame={f} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
