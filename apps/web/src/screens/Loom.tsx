import { useEffect, useMemo, useState } from "react";
import {
  fetchWeek,
  fetchPending,
  fetchProposal,
  approveProposal,
  rejectProposal,
  type WeekView,
  type ProposalDetail,
} from "../lib/loom.js";
import { GODS_DESIGN, roman } from "../lib/design.js";
import type { GodId } from "../../../../src/types.js";

/* ── constants (pixel-faithful to the prototype) ─────────────────── */
const ROW = 44; // px per hour
const H0 = 7; // first hour shown (07:00)
const H1 = 22; // last hour boundary (22:00) — 15 rows, 660px tall
const GRID_H = (H1 - H0) * ROW; // 660
const EASE = "cubic-bezier(0.22,1,0.36,1)";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Legend order per the prototype's constellation key. */
const LEGEND_ORDER: GodId[] = ["zeus", "athena", "asclepius", "hermes", "hestia", "apollo"];

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hourDec = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};
const fmt = (iso: string): string => {
  const d = new Date(iso);
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/* ── render model for a single placed block ─────────────────────── */
interface RB {
  key: string;
  top: number;
  height: number;
  bg: string;
  border: string;
  borderTop: string;
  titleColor: string;
  title: string;
  tag: string;
  tagColor: string;
  time: string;
  showTime: boolean;
  shadow: string;
  opacity: number;
  z: number;
  deco: string;
  anim: string;
  showArrow: boolean;
  arrowTo: string;
}

const topFor = (startDec: number): number => (clamp(startDec, H0, H1) - H0) * ROW + 2;
const heightFor = (startDec: number, endDec: number): number =>
  Math.max(16, (clamp(endDec, H0, H1) - clamp(startDec, H0, H1)) * ROW - 5);

/* ── the screen ─────────────────────────────────────────────────── */
export function Loom(): JSX.Element {
  const [week, setWeek] = useState<WeekView | null>(null);
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);

  const [view, setView] = useState<"planned" | "lived">("planned");
  const [proposalsOn, setProposalsOn] = useState(true);
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);

  const [approveHover, setApproveHover] = useState(false);
  const [rejectHover, setRejectHover] = useState(false);

  /* fetch week + first pending proposal */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const w = await fetchWeek();
        if (alive) setWeek(w);
      } catch {
        /* leave frame empty */
      }
      try {
        const pend = await fetchPending();
        const first = pend[0];
        if (first && alive) {
          setProposalId(first.id);
          const detail = await fetchProposal(first.id);
          if (alive) {
            setProposal(detail);
            setDecided(null);
          }
        }
      } catch {
        /* no proposals */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const lived = view === "lived";
  const changeCount = proposal
    ? proposal.diff.adds.length + proposal.diff.moves.length + proposal.diff.deletes.length
    : 0;
  const pending = Boolean(proposalsOn && !lived && proposal && !decided && changeCount > 0);

  /* ── week meta (title strip) ──────────────────────────────────── */
  const meta = useMemo(() => {
    if (!week) return null;
    const from = new Date(week.range.from);
    const to = new Date(week.range.to);
    const year = from.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const weekNum = Math.ceil(
      ((startOfDay(from).getTime() - startOfDay(oneJan).getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
    );
    const range =
      from.getMonth() === to.getMonth()
        ? `${MONTHS[from.getMonth()]} ${pad2(from.getDate())} — ${pad2(to.getDate())}`
        : `${MONTHS[from.getMonth()]} ${pad2(from.getDate())} — ${MONTHS[to.getMonth()]} ${pad2(to.getDate())}`;
    return {
      subtitle: `WOVEN BY THE COUNCIL — WEEK ${roman(weekNum)} · ${range} · ${roman(year)}`,
    };
  }, [week]);

  const remainLine =
    lived && week && week.stats.adherencePct != null
      ? `${week.stats.adherencePct}% of the woven week, kept.`
      : lived
        ? "The week, as it was lived."
        : week
          ? `${week.stats.totalBlocks} threads sworn — this week remains yours.`
          : "The council is weaving…";

  /* ── build the seven day columns ──────────────────────────────── */
  const built = useMemo(() => {
    const days: { label: string; isToday: boolean; nowTop: number | null }[] = [];
    const cols: RB[][] = [[], [], [], [], [], [], []];
    if (!week) return { days, cols };

    const weekStart = startOfDay(new Date(week.range.from));
    const now = new Date();
    const todayIdx = Math.round((startOfDay(now).getTime() - weekStart.getTime()) / 86400000);
    const nowDec = now.getHours() + now.getMinutes() / 60;

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 86400000);
      const isToday = i === todayIdx;
      days.push({
        label: `${WEEKDAYS[d.getDay()]} ${pad2(d.getDate())}`,
        isToday,
        nowTop: isToday && nowDec >= H0 && nowDec <= H1 ? (nowDec - H0) * ROW : null,
      });
    }

    const dayOf = (iso: string): number =>
      Math.round((startOfDay(new Date(iso)).getTime() - weekStart.getTime()) / 86400000);

    const anim = { i: 0 };
    const blockInAnim = (delayBoost = 0): string =>
      `mxBlockIn .8s ${EASE} ${(0.25 + anim.i++ * 0.05 + delayBoost).toFixed(2)}s both`;

    const godStyle = (godId: GodId): Pick<RB, "bg" | "border" | "borderTop" | "titleColor" | "tagColor" | "shadow" | "z"> => {
      const g = GODS_DESIGN[godId] ?? GODS_DESIGN.zeus;
      return {
        bg: `linear-gradient(rgba(${g.rgb},.14), rgba(${g.rgb},.14)) #FBF9F4`,
        border: `1px solid rgba(${g.rgb},.35)`,
        borderTop: `2px solid ${g.hue}`,
        titleColor: "#14131A",
        tagColor: g.hue,
        shadow: "0 10px 22px -14px rgba(20,19,26,.35)",
        z: 2,
      };
    };
    const worldStyle: Pick<RB, "bg" | "border" | "borderTop" | "titleColor" | "tagColor" | "shadow" | "z"> = {
      bg: "#ECE7DB",
      border: "1px solid #D8D0C0",
      borderTop: "1px solid #D8D0C0",
      titleColor: "#4A4740",
      tagColor: "#8A857A",
      shadow: "none",
      z: 1,
    };

    const push = (di: number, rb: RB): void => {
      if (di >= 0 && di < 7) cols[di].push(rb);
    };

    /* proposal indexes */
    const movedById = new Map<string, ProposalDetail["diff"]["moves"][number]>();
    const deletedIds = new Set<string>();
    if (pending && proposal) {
      for (const m of proposal.diff.moves) movedById.set(m.blockId, m);
      for (const d of proposal.diff.deletes) deletedIds.add(d.blockId);
    }

    /* ── the council's weave (above) ── */
    for (const b of week.blocks) {
      const di = dayOf(b.start);
      const s = hourDec(b.start);
      const e = hourDec(b.end);
      const g = GODS_DESIGN[b.godId] ?? GODS_DESIGN.zeus;
      const style = godStyle(b.godId);

      if (pending && deletedIds.has(b.id)) {
        push(di, {
          key: `del-${b.id}`,
          top: topFor(s),
          height: heightFor(s, e),
          bg: style.bg,
          border: "1px dashed rgba(226,130,60,.55)",
          borderTop: "1px dashed rgba(226,130,60,.55)",
          titleColor: style.titleColor,
          title: b.title,
          tag: "− REMOVE",
          tagColor: "#E2823C",
          time: `${fmt(b.start)} — ${fmt(b.end)}`,
          showTime: heightFor(s, e) >= 38,
          shadow: style.shadow,
          opacity: 1,
          z: 3,
          deco: "line-through",
          anim: `${blockInAnim(0.15)}, mxAsh 1.8s ease 1.6s forwards`,
          showArrow: false,
          arrowTo: "",
        });
        continue;
      }

      const moved = pending ? movedById.get(b.id) : undefined;
      if (moved) {
        const fs = moved.fromStart ? hourDec(moved.fromStart) : s;
        const fe = moved.fromEnd ? hourDec(moved.fromEnd) : e;
        // ghost at the old slot
        push(di, {
          key: `was-${b.id}`,
          top: topFor(fs),
          height: heightFor(fs, fe),
          bg: "transparent",
          border: "1px dashed #B9AF9C",
          borderTop: "1px dashed #B9AF9C",
          titleColor: style.titleColor,
          title: b.title,
          tag: "WAS",
          tagColor: "#8A857A",
          time: "",
          showTime: false,
          shadow: "none",
          opacity: 0.6,
          z: 2,
          deco: "none",
          anim: blockInAnim(),
          showArrow: true,
          arrowTo: fmt(moved.toStart),
        });
        // gold destination
        const ts = hourDec(moved.toStart);
        const te = hourDec(moved.toEnd);
        push(dayOf(moved.toStart), {
          key: `moved-${b.id}`,
          top: topFor(ts),
          height: heightFor(ts, te),
          bg: style.bg,
          border: "1px dashed #C6A15B",
          borderTop: "1px dashed #C6A15B",
          titleColor: style.titleColor,
          title: moved.title || b.title,
          tag: "→ MOVED",
          tagColor: "#C6A15B",
          time: `${fmt(moved.toStart)} — ${fmt(moved.toEnd)}`,
          showTime: heightFor(ts, te) >= 38,
          shadow: style.shadow,
          opacity: 1,
          z: 3,
          deco: "none",
          anim: `${blockInAnim(0.25)}, mxPulseGold 3s ease-in-out 1.4s infinite`,
          showArrow: false,
          arrowTo: "",
        });
        continue;
      }

      // normal / lived-status block
      let tag = g.name;
      let tagColor = style.tagColor;
      let deco = "none";
      let extraAnim = "";
      let opacity = 1;
      if (lived) {
        const st = (b.status || "").toLowerCase();
        if (st.includes("miss")) {
          tag = "MISSED";
          tagColor = "#E2823C";
          deco = "line-through";
          extraAnim = ", mxAsh 1.4s ease 1.2s forwards";
        } else if (st.includes("kept")) {
          tag = "KEPT";
        } else if (st.includes("liv") || st.includes("partial") || st.includes("done")) {
          tag = "LIVED";
        }
      }
      push(di, {
        key: `b-${b.id}`,
        top: topFor(s),
        height: heightFor(s, e),
        bg: style.bg,
        border: style.border,
        borderTop: style.borderTop,
        titleColor: style.titleColor,
        title: b.title,
        tag,
        tagColor,
        time: `${fmt(b.start)} — ${fmt(b.end)}`,
        showTime: heightFor(s, e) >= 38,
        shadow: style.shadow,
        opacity,
        z: style.z,
        deco,
        anim: `${blockInAnim()}${extraAnim}`,
        showArrow: false,
        arrowTo: "",
      });
    }

    /* ── the outer world (beneath) ── */
    for (const o of week.outerWorld) {
      const di = dayOf(o.start);
      const s = hourDec(o.start);
      const e = hourDec(o.end);

      if (pending && deletedIds.has(o.id)) {
        push(di, {
          key: `wdel-${o.id}`,
          top: topFor(s),
          height: heightFor(s, e),
          bg: worldStyle.bg,
          border: "1px dashed rgba(226,130,60,.55)",
          borderTop: "1px dashed rgba(226,130,60,.55)",
          titleColor: worldStyle.titleColor,
          title: o.title,
          tag: "− REMOVE",
          tagColor: "#E2823C",
          time: `${fmt(o.start)} — ${fmt(o.end)}`,
          showTime: heightFor(s, e) >= 38,
          shadow: "none",
          opacity: 1,
          z: 3,
          deco: "line-through",
          anim: `${blockInAnim(0.15)}, mxAsh 1.8s ease 1.6s forwards`,
          showArrow: false,
          arrowTo: "",
        });
        continue;
      }

      const moved = pending ? movedById.get(o.id) : undefined;
      if (moved) {
        const fs = moved.fromStart ? hourDec(moved.fromStart) : s;
        const fe = moved.fromEnd ? hourDec(moved.fromEnd) : e;
        push(di, {
          key: `wwas-${o.id}`,
          top: topFor(fs),
          height: heightFor(fs, fe),
          bg: "transparent",
          border: "1px dashed #B9AF9C",
          borderTop: "1px dashed #B9AF9C",
          titleColor: worldStyle.titleColor,
          title: o.title,
          tag: "WAS",
          tagColor: "#8A857A",
          time: "",
          showTime: false,
          shadow: "none",
          opacity: 0.6,
          z: 1,
          deco: "none",
          anim: blockInAnim(),
          showArrow: true,
          arrowTo: fmt(moved.toStart),
        });
        const ts = hourDec(moved.toStart);
        const te = hourDec(moved.toEnd);
        push(dayOf(moved.toStart), {
          key: `wmoved-${o.id}`,
          top: topFor(ts),
          height: heightFor(ts, te),
          bg: worldStyle.bg,
          border: "1px dashed #C6A15B",
          borderTop: "1px dashed #C6A15B",
          titleColor: worldStyle.titleColor,
          title: moved.title || o.title,
          tag: "→ MOVED",
          tagColor: "#C6A15B",
          time: `${fmt(moved.toStart)} — ${fmt(moved.toEnd)}`,
          showTime: heightFor(ts, te) >= 38,
          shadow: "none",
          opacity: 1,
          z: 3,
          deco: "none",
          anim: `${blockInAnim(0.25)}, mxPulseGold 3s ease-in-out 1.4s infinite`,
          showArrow: false,
          arrowTo: "",
        });
        continue;
      }

      push(di, {
        key: `w-${o.id}`,
        top: topFor(s),
        height: heightFor(s, e),
        bg: worldStyle.bg,
        border: worldStyle.border,
        borderTop: worldStyle.borderTop,
        titleColor: worldStyle.titleColor,
        title: o.title,
        tag: "WORLD",
        tagColor: worldStyle.tagColor,
        time: `${fmt(o.start)} — ${fmt(o.end)}`,
        showTime: heightFor(s, e) >= 38,
        shadow: "none",
        opacity: 1,
        z: 1,
        deco: "none",
        anim: blockInAnim(),
        showArrow: false,
        arrowTo: "",
      });
    }

    /* ── proposal additions (net-new gold threads) ── */
    if (pending && proposal) {
      for (const [ai, add] of proposal.diff.adds.entries()) {
        const di = dayOf(add.start);
        const s = hourDec(add.start);
        const e = hourDec(add.end);
        const style = godStyle(add.godId);
        push(di, {
          key: `add-${ai}`,
          top: topFor(s),
          height: heightFor(s, e),
          bg: style.bg,
          border: "1px dashed #C6A15B",
          borderTop: "1px dashed #C6A15B",
          titleColor: style.titleColor,
          title: add.title,
          tag: "+ PROPOSED",
          tagColor: "#C6A15B",
          time: `${fmt(add.start)} — ${fmt(add.end)}`,
          showTime: heightFor(s, e) >= 38,
          shadow: style.shadow,
          opacity: 1,
          z: 3,
          deco: "none",
          anim: `${blockInAnim(0.35)}, mxPulseGold 3s ease-in-out 1.6s infinite`,
          showArrow: false,
          arrowTo: "",
        });
      }
    }

    return { days, cols };
  }, [week, lived, pending, proposal]);

  /* ── decisions ────────────────────────────────────────────────── */
  const onApprove = async (): Promise<void> => {
    if (!proposalId) return;
    setDecided("approved");
    try {
      await approveProposal(proposalId);
      const w = await fetchWeek();
      setWeek(w);
    } catch {
      /* keep the sealed state; refetch will reconcile later */
    }
  };
  const onReject = async (): Promise<void> => {
    if (!proposalId) return;
    setDecided("rejected");
    try {
      await rejectProposal(proposalId);
    } catch {
      /* no-op */
    }
  };

  const critique = proposal?.critique ?? null;
  const critiqueLine = critique
    ? critique.verdict === "clear"
      ? "Momus finds no fault in the weave."
      : critique.risks[0] ?? "Momus raises concerns."
    : "";
  const verdictDot = critique?.verdict === "concerns" ? "#E2823C" : "#C6A15B";

  const barVisible = pending;
  const sealedVisible = decided === "approved" && !lived && proposalsOn;

  const propsOnVisual = proposalsOn && !lived;

  /* ── styles ───────────────────────────────────────────────────── */
  const chipLabel: React.CSSProperties = {
    fontFamily: "'Cormorant SC',serif",
    fontSize: 10,
    letterSpacing: "0.26em",
    padding: "11px 18px",
    border: "none",
    cursor: "pointer",
    transition: "all .6s",
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#F5F2EA",
        color: "#14131A",
        overflow: "hidden",
        paddingBottom: 110,
        fontFamily: "'Schibsted Grotesk','Helvetica Neue',sans-serif",
      }}
    >
      {/* slow-turning contour disc */}
      <div
        style={{
          position: "absolute",
          top: -420,
          right: -300,
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
          zIndex: 2,
          display: "flex",
          alignItems: "flex-end",
          gap: 40,
          padding: "38px 44px 20px",
          animation: `mxRise .9s ${EASE} both`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h1 style={{ margin: 0, fontFamily: "'Fraunces',Georgia,serif", fontWeight: 390, fontSize: 52, lineHeight: 1 }}>
            The Loom
          </h1>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: "0.3em", color: "#8A857A" }}>
            {meta?.subtitle ?? "WOVEN BY THE COUNCIL"}
          </span>
        </div>
        <p
          style={{
            margin: "0 0 4px",
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontStyle: "italic",
            fontSize: 21,
            color: "#4A4740",
          }}
        >
          {remainLine}
        </p>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {/* PLANNED / LIVED */}
          <div style={{ display: "flex", border: "1px solid #D8D0C0", borderRadius: 2, overflow: "hidden" }}>
            <button
              onClick={() => setView("planned")}
              style={{
                ...chipLabel,
                background: lived ? "transparent" : "#14131A",
                color: lived ? "#4A4740" : "#EDE6D6",
              }}
            >
              PLANNED
            </button>
            <button
              onClick={() => setView("lived")}
              style={{
                ...chipLabel,
                borderLeft: "1px solid #D8D0C0",
                background: lived ? "#14131A" : "transparent",
                color: lived ? "#EDE6D6" : "#4A4740",
              }}
            >
              LIVED
            </button>
          </div>

          {/* PROPOSALS toggle */}
          <button
            onClick={() => setProposalsOn((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              fontFamily: "'Cormorant SC',serif",
              fontSize: 10,
              letterSpacing: "0.26em",
              padding: "11px 16px",
              border: `1px solid ${propsOnVisual ? "rgba(198,161,91,.6)" : "#D8D0C0"}`,
              borderRadius: 2,
              background: "transparent",
              color: propsOnVisual ? "#C6A15B" : "#8A857A",
              cursor: "pointer",
              transition: "all .6s",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                transform: "rotate(45deg)",
                background: propsOnVisual ? "#C6A15B" : "#D8D0C0",
                transition: "background .6s",
              }}
            />
            PROPOSALS
          </button>
        </div>
      </div>

      {/* legend */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          padding: "10px 44px 18px",
          animation: `mxRise .9s ${EASE} .15s both`,
        }}
      >
        {LEGEND_ORDER.map((id, i) => {
          const g = GODS_DESIGN[id];
          return (
            <div key={id} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: 26, height: 1, background: "#D8D0C0", margin: "0 10px" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 6, height: 6, transform: "rotate(45deg)", background: g.hue }} />
                <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: "0.24em", color: "#4A4740" }}>
                  {g.name}
                </span>
              </div>
            </div>
          );
        })}
        <div style={{ width: 26, height: 1, background: "#D8D0C0", margin: "0 10px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 8, height: 8, background: "#ECE7DB", border: "1px solid #D8D0C0" }} />
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: "0.24em", color: "#8A857A" }}>
            OUTER WORLD — BENEATH
          </span>
        </div>
        <span
          style={{ marginLeft: "auto", fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: "0.26em", color: "#C6A15B" }}
        >
          TODAY — THE GOLD THREAD
        </span>
      </div>

      {/* week grid */}
      <div style={{ position: "relative", zIndex: 2, borderTop: "1px solid #14131A", margin: "0 44px" }}>
        {/* day header row */}
        <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)" }}>
          <div style={{ borderBottom: "1px solid #D8D0C0" }} />
          {built.days.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                padding: "13px 0",
                borderBottom: "1px solid #D8D0C0",
                borderLeft: "1px solid #D8D0C0",
              }}
            >
              {d.isToday && <div style={{ width: 5, height: 5, transform: "rotate(45deg)", background: "#C6A15B" }} />}
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  color: d.isToday ? "#C6A15B" : "#4A4740",
                }}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>

        {/* body: hour rail + 7 day columns */}
        <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)" }}>
          {/* hour rail */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {Array.from({ length: H1 - H0 }, (_, i) => (
              <div key={i} style={{ height: ROW, display: "flex", justifyContent: "flex-end", paddingRight: 12 }}>
                <span
                  style={{
                    fontFamily: "'Fraunces',Georgia,serif",
                    fontStyle: "italic",
                    fontSize: 12,
                    color: "#8A857A",
                    transform: "translateY(-7px)",
                  }}
                >
                  {pad2(H0 + i)}
                </span>
              </div>
            ))}
          </div>

          {/* day columns */}
          {built.days.map((d, di) => (
            <div
              key={di}
              style={{
                position: "relative",
                height: GRID_H,
                borderLeft: "1px solid #D8D0C0",
                background: d.isToday ? "rgba(198,161,91,.05)" : "transparent",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0px, transparent 43px, #E3DCCD 43px, #E3DCCD 44px)",
              }}
            >
              {(built.cols[di] ?? []).map((b) => (
                <div
                  key={b.key}
                  style={{
                    position: "absolute",
                    left: 6,
                    right: 6,
                    top: b.top,
                    height: b.height,
                    background: b.bg,
                    border: b.border,
                    borderTop: b.borderTop,
                    borderRadius: 2,
                    padding: "4px 10px",
                    boxShadow: b.shadow,
                    opacity: b.opacity,
                    zIndex: b.z,
                    overflow: "hidden",
                    animation: b.anim,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: b.titleColor,
                        textDecoration: b.deco,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {b.title}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 8,
                        letterSpacing: "0.2em",
                        color: b.tagColor,
                        flex: "none",
                      }}
                    >
                      {b.tag}
                    </span>
                  </div>
                  {b.showTime && (
                    <span style={{ display: "block", marginTop: 2, fontSize: 10, color: "#8A857A" }}>{b.time}</span>
                  )}
                  {b.showArrow && (
                    <span
                      style={{
                        display: "block",
                        marginTop: 1,
                        fontFamily: "'Cormorant SC',serif",
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        color: "#C6A15B",
                      }}
                    >
                      ↓ MOVED TO {b.arrowTo}
                    </span>
                  )}
                </div>
              ))}

              {/* today gold thread */}
              {d.nowTop != null && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: d.nowTop,
                    zIndex: 6,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      transform: "rotate(45deg)",
                      background: "#C6A15B",
                      marginLeft: -4,
                      animation: "mxOrb 3.5s ease-in-out infinite",
                    }}
                  />
                  <div style={{ flex: 1, height: 1, background: "#C6A15B" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #14131A" }} />
      </div>

      {/* proposal bar */}
      {barVisible && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "#FBF9F4",
            border: "1px solid #14131A",
            borderRadius: 2,
            padding: "14px 22px",
            boxShadow: "0 30px 60px -30px rgba(20,19,26,.4)",
            animation: `mxRiseUp 1s ${EASE} .8s both`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, transform: "rotate(45deg)", background: verdictDot }} />
              <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: "0.28em", color: "#14131A" }}>
                THE COUNCIL PROPOSES — {roman(changeCount)} {changeCount === 1 ? "CHANGE" : "CHANGES"}
              </span>
            </div>
            <button
              onClick={() => void onApprove()}
              onMouseEnter={() => setApproveHover(true)}
              onMouseLeave={() => setApproveHover(false)}
              style={{
                fontFamily: "'Cormorant SC',serif",
                fontSize: 11,
                letterSpacing: "0.26em",
                color: "#C6A15B",
                background: approveHover ? "rgba(198,161,91,.1)" : "transparent",
                border: `1px solid ${approveHover ? "#C6A15B" : "rgba(198,161,91,.55)"}`,
                padding: "10px 18px",
                borderRadius: 2,
                cursor: "pointer",
                transition: `all .7s ${EASE}`,
              }}
            >
              APPROVE —
            </button>
            <button
              onClick={() => void onReject()}
              onMouseEnter={() => setRejectHover(true)}
              onMouseLeave={() => setRejectHover(false)}
              style={{
                fontFamily: "'Cormorant SC',serif",
                fontSize: 11,
                letterSpacing: "0.26em",
                color: rejectHover ? "#4A4740" : "#8A857A",
                background: "transparent",
                border: `1px solid ${rejectHover ? "#8A857A" : "#D8D0C0"}`,
                padding: "10px 18px",
                borderRadius: 2,
                cursor: "pointer",
                transition: "all .7s",
              }}
            >
              REJECT
            </button>
          </div>
          {critiqueLine && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: "'Cormorant SC',serif",
                  fontSize: 8,
                  letterSpacing: "0.24em",
                  color: verdictDot,
                  flex: "none",
                }}
              >
                MOMUS
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "#4A4740",
                }}
              >
                {critiqueLine}
              </span>
            </div>
          )}
        </div>
      )}

      {/* sealed chip */}
      {sealedVisible && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#FBF9F4",
            border: "1px solid rgba(198,161,91,.6)",
            borderRadius: 2,
            padding: "14px 22px",
            boxShadow: "0 30px 60px -30px rgba(20,19,26,.4)",
            animation: `mxRiseUp .9s ${EASE} both`,
          }}
        >
          <div style={{ width: 6, height: 6, background: "#C6A15B", transform: "rotate(45deg)" }} />
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: "0.28em", color: "#C6A15B" }}>
            WOVEN — THE WEEK IS YOURS
          </span>
        </div>
      )}

      {/* grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
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
