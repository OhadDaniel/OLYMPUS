import { useCallback, useEffect, useState } from "react";
import { GODS } from "../../../../src/pantheon.js";
import type { GodId } from "../../../../src/types.js";
import {
  approveProposal,
  fetchPending,
  fetchProposal,
  fetchWeek,
  rejectProposal,
  type ProposalDetail,
  type WeekView,
} from "../lib/loom.js";

const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_PX = 46;
const GRID_H = (HOUR_END - HOUR_START) * HOUR_PX;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function pos(weekStart: Date, startISO: string, endISO: string) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const dayIndex = Math.round((startOfDay(s).getTime() - startOfDay(weekStart).getTime()) / 86_400_000);
  const top = (s.getHours() + s.getMinutes() / 60 - HOUR_START) * HOUR_PX;
  const height = Math.max(18, ((e.getTime() - s.getTime()) / 3_600_000) * HOUR_PX);
  return { dayIndex, top, height };
}
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function Loom() {
  const [week, setWeek] = useState<WeekView | null>(null);
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);

  const load = useCallback(async () => {
    const w = await fetchWeek();
    setWeek(w);
    const pending = await fetchPending();
    if (pending.length > 0 && pending[0]) setProposal(await fetchProposal(pending[0].id));
    else setProposal(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!week) return <div className="p-8 text-center text-ink-3">Unspooling the Loom…</div>;

  const weekStart = startOfDay(new Date(week.range.from));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const deleteIds = new Set((proposal?.diff.deletes ?? []).map((d) => d.blockId));
  const moveIds = new Set((proposal?.diff.moves ?? []).map((m) => m.blockId));

  const approve = async () => {
    if (!proposal) return;
    await approveProposal(proposal.id);
    await load();
  };
  const reject = async () => {
    if (!proposal) return;
    await rejectProposal(proposal.id);
    await load();
  };

  const godBlock = (godId: GodId, title: string, top: number, height: number, faded: boolean, tag?: string) => {
    const g = GODS[godId];
    return (
      <div
        className="absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight"
        style={{
          top,
          height,
          background: hexA(g.accent, faded ? 0.06 : 0.16),
          borderLeft: `3px solid ${g.accent}`,
          color: faded ? "var(--color-ink-3)" : "var(--color-ink)",
          opacity: faded ? 0.5 : 1,
          textDecoration: tag === "remove" ? "line-through" : "none",
          zIndex: 10,
        }}
        title={title}
      >
        <span style={{ color: g.accent }}>{title}</span>
        {tag && <span className="ml-1 text-[9px] uppercase tracking-wider text-ink-3">{tag}</span>}
      </div>
    );
  };

  const ghost = (godId: GodId | null, title: string, top: number, height: number, label: string) => {
    const accent = godId ? GODS[godId].accent : "#C6A15B";
    return (
      <div
        className="absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight"
        style={{
          top,
          height,
          border: `1.5px dashed ${accent}`,
          background: hexA(accent, 0.08),
          color: accent,
          boxShadow: `0 0 10px ${hexA(accent, 0.35)}`,
          zIndex: 20,
        }}
        title={title}
      >
        <span>{title}</span>
        <span className="ml-1 text-[9px] uppercase tracking-wider">{label}</span>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="font-display text-lg uppercase tracking-[0.25em] text-gold">The Loom</h2>
        <span className="font-label text-sm text-ink-3">
          {week.stats.totalBlocks} blocks · adherence {week.stats.adherencePct ?? "—"}%
        </span>
      </div>

      {/* day headers */}
      <div className="grid grid-cols-[44px_repeat(7,1fr)] border-b border-hairline px-2 text-center">
        <div />
        {days.map((d, i) => (
          <div key={i} className="py-2">
            <div className="font-label text-xs uppercase tracking-widest text-ink-2">{DAY_NAMES[d.getDay()]}</div>
            <div className="font-display text-sm text-ink">{d.getDate()}</div>
          </div>
        ))}
      </div>

      {/* grid body */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="grid grid-cols-[44px_repeat(7,1fr)]" style={{ height: GRID_H }}>
          {/* hour gutter */}
          <div className="relative">
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <div key={i} className="absolute right-1 text-[10px] text-ink-3" style={{ top: i * HOUR_PX - 6 }}>
                {String(HOUR_START + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((_, dayIndex) => (
            <div key={dayIndex} className="relative border-l border-hairline/60">
              {/* hour lines */}
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-hairline/30" style={{ top: i * HOUR_PX }} />
              ))}

              {/* outer world (beneath) */}
              {week.outerWorld
                .map((e) => ({ e, p: pos(weekStart, e.start, e.end) }))
                .filter(({ p }) => p.dayIndex === dayIndex)
                .map(({ e, p }) => (
                  <div
                    key={e.id}
                    className="absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-[10px] leading-tight"
                    style={{ top: p.top, height: p.height, background: "#1e1c26", border: "1px solid var(--color-outer)", color: "var(--color-ink-3)", zIndex: 1 }}
                    title={e.title}
                  >
                    {e.title} · {hhmm(e.start)}
                  </div>
                ))}

              {/* designed blocks (above) */}
              {week.blocks
                .map((b) => ({ b, p: pos(weekStart, b.start, b.end) }))
                .filter(({ p }) => p.dayIndex === dayIndex)
                .map(({ b, p }) => {
                  const tag = deleteIds.has(b.id) ? "remove" : moveIds.has(b.id) ? "moving" : undefined;
                  const faded = Boolean(tag);
                  return <div key={b.id}>{godBlock(b.godId, b.title, p.top, p.height, faded, tag)}</div>;
                })}

              {/* proposal adds */}
              {(proposal?.diff.adds ?? [])
                .map((a) => ({ a, p: pos(weekStart, a.start, a.end) }))
                .filter(({ p }) => p.dayIndex === dayIndex)
                .map(({ a, p }, i) => (
                  <div key={`add-${i}`}>{ghost(a.godId, a.title, p.top, p.height, "add")}</div>
                ))}

              {/* proposal move targets */}
              {(proposal?.diff.moves ?? [])
                .map((m) => ({ m, p: pos(weekStart, m.toStart, m.toEnd) }))
                .filter(({ p }) => p.dayIndex === dayIndex)
                .map(({ m, p }, i) => (
                  <div key={`mv-${i}`}>{ghost(m.godId, m.title, p.top, p.height, "→ move")}</div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* approve / reject bar */}
      {proposal && (
        <div className="flex items-center justify-between border-t border-gold/30 bg-s1 px-4 py-3">
          <span className="font-label text-sm text-ink-2">
            A proposal awaits — <span className="text-gold">{proposal.diff.adds.length} add</span>,{" "}
            {proposal.diff.moves.length} move, {proposal.diff.deletes.length} remove
          </span>
          <div className="flex gap-2">
            <button onClick={() => void reject()} className="rounded-lg border border-hairline px-4 py-2 font-label uppercase tracking-widest text-ink-2 hover:text-ink">
              Reject
            </button>
            <button onClick={() => void approve()} className="rounded-lg border border-gold/50 bg-gold/15 px-5 py-2 font-label uppercase tracking-widest text-gold hover:bg-gold/25">
              Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
