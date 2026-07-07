import { useEffect, useRef, useState } from "react";
import type { GodId } from "../../../../src/types.js";
import { GODS_DESIGN, GOD_ORDER, roman, greeting } from "../lib/design.js";
import { GodIcon } from "../components/GodIcon.js";
import { Statue } from "../components/Statue.js";
import { fetchWeek } from "../lib/loom.js";
import type { WeekView } from "../lib/loom.js";
import { fetchObservatory } from "../lib/insight.js";
import type { Observatory } from "../lib/insight.js";

/* ============================================================
   OLYMPUS — Home. The cloud hero, the gold thread, the six gods,
   the halls. Ported pixel-faithfully from Olympus.dc.html.
   ============================================================ */

export type OlympusView = "council" | "loom" | "observatory" | "forge" | "weekly" | "veil";

const EASE = "cubic-bezier(0.22,1,0.36,1)";
const GOLD = "#C6A15B";
const INK = "#14131A";
const SLATE = "#4A4740";
const MIST = "#8A857A";
const STONE = "#D8D0C0";
const PANEL = "#FBF9F4";
const BONE = "#F5F2EA";

/* --- today-strip timeline: 07:00 → 22:00 --- */
const DAY_START = 7 * 60;
const DAY_END = 22 * 60;
const DAY_SPAN = DAY_END - DAY_START;
const minutesOf = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const clampPct = (m: number): number => Math.max(0, Math.min(100, ((m - DAY_START) / DAY_SPAN) * 100));
const hhmm = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

/* --- per-god card metadata that isn't already in GODS_DESIGN --- */
type CardMeta = {
  id: GodId;
  eyebrow: string; // zeus gets the special "I — THE CHAIR"
  src: string;
  treatment: "cutout" | "plate";
  def: { done: number; total: number; opacity: number };
};
const CARDS: CardMeta[] = [
  { id: "zeus", eyebrow: "I — THE CHAIR", src: "zeus-live.gif", treatment: "cutout", def: { done: 7, total: 7, opacity: 1 } },
  { id: "athena", eyebrow: "II", src: "athena-nike-live.gif", treatment: "cutout", def: { done: 6, total: 7, opacity: 1 } },
  { id: "apollo", eyebrow: "III", src: "apollo-laurel-live.gif", treatment: "cutout", def: { done: 3, total: 7, opacity: 0.78 } },
  { id: "hermes", eyebrow: "IV", src: "hermes-live.gif", treatment: "cutout", def: { done: 2, total: 7, opacity: 0.5 } },
  { id: "asclepius", eyebrow: "V", src: "asclepius-live.gif", treatment: "plate", def: { done: 5, total: 7, opacity: 1 } },
  { id: "hestia", eyebrow: "VI", src: "hestia-live.gif", treatment: "plate", def: { done: 7, total: 7, opacity: 1 } },
];

const HALLS: Array<{ num: string; title: string; tag: string; view: OlympusView; last?: boolean }> = [
  { num: "I", title: "The Council", tag: "speak; the gods attend", view: "council" },
  { num: "II", title: "The Loom", tag: "the schedule of record, woven", view: "loom" },
  { num: "III", title: "The Observatory", tag: "the week, read as stars", view: "observatory" },
  { num: "IV", title: "The Forge", tag: "trust, memory & the outer gates", view: "forge", last: true },
];

/* ---- fallback strip data (mirrors the prototype when the API is silent) ---- */
type Gem = { left: number; hue: string; rgb: string; title: string };
type OuterBar = { left: number; width: number; title: string };
const FALLBACK_GEMS: Gem[] = [
  { left: 1.2, hue: "#4F8C82", rgb: "79,140,130", title: "Morning Run — Asclepius · 07:00" },
  { left: 73.3, hue: GOLD, rgb: "198,161,91", title: "The Council — 18:00" },
];
const FALLBACK_OUTER: OuterBar[] = [
  { left: 16.7, width: 3.3, title: "Standup — 09:30" },
  { left: 40, width: 6.6, title: "Client call — 13:00" },
];

/* ============================================================ */

export function Olympus({ onNavigate }: { onNavigate?: (v: OlympusView) => void }) {
  const go = (v: OlympusView) => onNavigate?.(v);

  const [week, setWeek] = useState<WeekView | null>(null);
  const [obs, setObs] = useState<Observatory | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);
  const [zeusFailed, setZeusFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetchWeek().then((w) => live && setWeek(w)).catch(() => {});
    fetchObservatory().then((o) => live && setObs(o)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  /* ---- parallax (rAF-throttled pointer tracking) ---- */
  const zeusRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const starNearRef = useRef<HTMLDivElement>(null);
  const starFarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (zeusRef.current) zeusRef.current.style.transform = `translate3d(${nx * 12}px,${ny * 8}px,0)`;
        if (orbRef.current) orbRef.current.style.transform = `translate3d(${nx * 5}px,${ny * 4}px,0)`;
        if (starNearRef.current) starNearRef.current.style.transform = `translate3d(${-nx * 14}px,${-ny * 9}px,0)`;
        if (starFarRef.current) starFarRef.current.style.transform = `translate3d(${-nx * 6}px,${-ny * 4}px,0)`;
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ---- headline: greeting() gives "Good afternoon, Ohad"; split the name out ---- */
  const userName = "Ohad";
  const full = greeting(userName);
  const salutation = full.slice(0, Math.max(0, full.length - userName.length)).replace(/,\s*$/, "");

  /* ---- eyebrow: WEEK XXVIII · TUESDAY ---- */
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);

  /* ---- today strip: build gems + outer bars from the week (or fall back) ---- */
  let gems: Gem[] = FALLBACK_GEMS;
  let outer: OuterBar[] = FALLBACK_OUTER;
  if (week) {
    gems = week.blocks.map((b) => {
      const g = GODS_DESIGN[b.godId];
      return {
        left: clampPct(minutesOf(b.start)),
        hue: g.hue,
        rgb: g.rgb,
        title: `${b.title} — ${g.name} · ${hhmm(b.start)}`,
      };
    });
    outer = week.outerWorld.map((o) => {
      const l = clampPct(minutesOf(o.start));
      const r = clampPct(minutesOf(o.end));
      return { left: l, width: Math.max(2, r - l), title: `${o.title} — ${hhmm(o.start)}` };
    });
  }

  /* ---- now marker ---- */
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowPct = clampPct(nowMin);
  const nowLabel = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const barFor = (id: GodId) => obs?.bars.find((b) => b.godId === id) ?? null;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: BONE, color: INK, overflow: "hidden" }}>
      {/* ============ CLOUD HERO ============ */}
      <div style={{ position: "relative", height: "62vh", minHeight: 620, background: "#E9EDF0", overflow: "hidden" }}>
        <div ref={starFarRef} style={{ position: "absolute", inset: "-6%", willChange: "transform" }}>
          {!heroFailed && (
            <img
              src="/assets/olympus.gif"
              alt="Olympus among the clouds"
              onError={() => setHeroFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "saturate(.72) brightness(1.1) contrast(.97)",
                animation: "mxKenBurns 60s ease-in-out infinite alternate",
              }}
            />
          )}
        </div>
        {/* drifting cloud veils */}
        <div ref={starNearRef} style={{ position: "absolute", left: "-25%", right: "-25%", top: "6%", height: "44%", willChange: "transform" }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, rgba(251,249,244,0), rgba(251,249,244,.65) 35%, rgba(251,249,244,.2) 58%, rgba(251,249,244,0))",
              filter: "blur(26px)",
              animation: "mxWind 44s ease-in-out infinite alternate",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: "-25%",
            right: "-25%",
            bottom: "4%",
            height: "40%",
            background: "linear-gradient(90deg, rgba(251,249,244,0), rgba(251,249,244,.55) 48%, rgba(251,249,244,0) 78%)",
            filter: "blur(30px)",
            animation: "mxWind2 56s ease-in-out infinite alternate",
          }}
        />
        {/* fades into the page */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(245,242,234,.3), rgba(245,242,234,0) 28%, rgba(245,242,234,0) 60%, #F5F2EA)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "58%", background: "linear-gradient(90deg, rgba(245,242,234,.8), rgba(245,242,234,0))" }} />

        {/* the breathing gold orb */}
        <div ref={orbRef} style={{ position: "absolute", left: "14.5%", top: "21%", willChange: "transform" }}>
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%, #E8C87E, #C6A15B 62%, #9A7B40)",
              animation: "mxOrbBig 6.5s ease-in-out infinite, mxDrift 11s ease-in-out infinite",
            }}
          />
        </div>

        {/* zeus above the clouds */}
        <div style={{ position: "absolute", right: "7%", bottom: "12%" }}>
          <div ref={zeusRef} style={{ willChange: "transform" }}>
            <div style={{ animation: `mxRise 2s ${EASE} .9s both`, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {!zeusFailed ? (
                <img
                  src="/assets/zeus-live.gif"
                  alt="Zeus — the chair"
                  onError={() => setZeusFailed(true)}
                  style={{
                    height: "min(46vh, 31vw)",
                    mixBlendMode: "multiply",
                    filter: "brightness(1.16) contrast(1.03)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 84%, transparent 100%)",
                    maskImage: "linear-gradient(to bottom, black 84%, transparent 100%)",
                    animation: "mxDrift 20s ease-in-out infinite",
                  }}
                />
              ) : (
                <div style={{ width: "min(38vh, 26vw)", animation: "mxDrift 20s ease-in-out infinite" }}>
                  <Statue src={undefined} god={GODS_DESIGN.zeus} height={360} treatment="cutout" animate="none" />
                </div>
              )}
              <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 11, letterSpacing: ".5em", color: GOLD, marginTop: -20 }}>ZEUS</span>
            </div>
          </div>
        </div>

        {/* greeting */}
        <div
          style={{
            position: "absolute",
            left: "7%",
            top: "44%",
            transform: "translateY(-56%)",
            zIndex: 3,
            maxWidth: "min(760px, 51vw)",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            animation: `mxRise 1.6s ${EASE} .4s both`,
          }}
        >
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".44em", color: GOLD }}>
            OLYMPUS — WEEK {roman(weekNum)} · {weekday}
          </span>
          <h1 style={{ margin: 0, fontFamily: "'Fraunces',Georgia,serif", fontWeight: 340, fontSize: 84, lineHeight: 1.04, color: INK }}>
            {salutation}, <span style={{ fontStyle: "italic", color: GOLD }}>{userName}</span>.
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: "italic",
              fontSize: 21,
              lineHeight: 1.5,
              color: SLATE,
              textShadow: "0 0 22px rgba(245,242,234,.95), 0 0 8px rgba(245,242,234,.9)",
            }}
          >
            The council kept the night watch. The Loom holds; three small matters wait without urgency.
          </p>
        </div>
      </div>

      {/* ============ TODAY STRIP — THE GOLD THREAD ============ */}
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "34px 48px 10px", animation: `mxRise 1.2s ${EASE} 1s both` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".32em", color: INK }}>TODAY — THE GOLD THREAD</span>
          <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 15, color: MIST }}>
            three claims; the rest of the day is yours
          </span>
          <button
            type="button"
            onClick={() => go("loom")}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontFamily: "'Cormorant SC',serif",
              fontSize: 11,
              letterSpacing: ".28em",
              color: GOLD,
            }}
          >
            OPEN THE LOOM —
          </button>
        </div>
        <div style={{ position: "relative", height: 44, marginTop: 18, borderTop: `1px solid ${STONE}`, borderBottom: `1px solid ${STONE}` }}>
          {/* outer world, beneath */}
          {outer.map((o, i) => (
            <div
              key={`outer-${i}`}
              title={o.title}
              style={{
                position: "absolute",
                left: `${o.left}%`,
                width: `${o.width}%`,
                top: 14,
                height: 14,
                background: "#ECE7DB",
                border: `1px solid ${STONE}`,
                borderRadius: 2,
              }}
            />
          ))}
          {/* god gems, above */}
          {gems.map((g, i) => (
            <GodGem key={`gem-${i}`} gem={g} />
          ))}
          {/* now */}
          <div style={{ position: "absolute", left: `${nowPct}%`, top: 0, bottom: 0, width: 1, background: GOLD }} />
          <div
            style={{
              position: "absolute",
              left: `${nowPct}%`,
              top: -4,
              width: 7,
              height: 7,
              transform: "translateX(-50%) rotate(45deg)",
              background: GOLD,
              animation: "mxOrb 3.5s ease-in-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: `calc(${nowPct}% + 6px)`,
              bottom: 4,
              fontFamily: "'Cormorant SC',serif",
              fontSize: 8,
              letterSpacing: ".24em",
              color: GOLD,
              whiteSpace: "nowrap",
            }}
          >
            NOW — {nowLabel}
          </span>
          <span style={{ position: "absolute", left: 0, bottom: -22, fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".2em", color: MIST }}>07:00</span>
          <span style={{ position: "absolute", right: 0, bottom: -22, fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".2em", color: MIST }}>22:00</span>
        </div>
      </div>

      {/* ============ THE SIX GODS — ADHERENCE ============ */}
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "52px 48px 26px", animation: `mxRise 1.2s ${EASE} 1.3s both` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".32em", color: INK }}>THE SIX GODS — SEVEN-DAY ADHERENCE</span>
          <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 15, color: MIST }}>
            they dim on quiet weeks; they glow on return. never an alarm.
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", border: `1px solid ${INK}`, marginTop: 24, background: PANEL }}>
          {CARDS.map((c, i) => {
            const bar = barFor(c.id);
            const done = bar ? bar.done : c.def.done;
            const total = bar ? bar.planned || 7 : c.def.total;
            const opacity = bar ? 0.45 + 0.55 * Math.min(1, (bar.planned ? done / bar.planned : 0)) : c.def.opacity;
            return <GodCard key={c.id} meta={c} done={done} total={total} opacity={opacity} last={i === CARDS.length - 1} />;
          })}
        </div>
      </div>

      {/* ============ THE HALLS ============ */}
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "40px 48px 30px", animation: `mxRise 1.2s ${EASE} 1.6s both` }}>
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 12, letterSpacing: ".32em", color: INK }}>THE HALLS</span>
        <div style={{ marginTop: 18 }}>
          {HALLS.map((h) => (
            <HallRow key={h.view} hall={h} onOpen={() => go(h.view)} />
          ))}
        </div>
      </div>

      {/* footer */}
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 48px 36px" }}>
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 10, letterSpacing: ".28em", color: MIST }}>MAXWELL — OLYMPUS · THE FIELD STAYS NEUTRAL</span>
        <VeilLink onOpen={() => go("veil")} />
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

/* ============================================================ */

function GodGem({ gem }: { gem: Gem }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      title={gem.title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: `${gem.left}%`,
        top: "50%",
        width: 13,
        height: 13,
        transform: "translateY(-50%) rotate(45deg)",
        background: gem.hue,
        boxShadow: hover ? `0 0 22px rgba(${gem.rgb},.9)` : `0 0 12px rgba(${gem.rgb},.5)`,
        cursor: "pointer",
        transition: "box-shadow .6s",
      }}
    />
  );
}

function GodCard({
  meta,
  done,
  total,
  opacity,
  last,
}: {
  meta: CardMeta;
  done: number;
  total: number;
  opacity: number;
  last: boolean;
}) {
  const g = GODS_DESIGN[meta.id];
  const [hover, setHover] = useState(false);
  const dim = opacity < 0.55;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px 15px",
        borderRight: last ? undefined : `1px solid ${INK}`,
        opacity,
        background: hover ? BONE : "transparent",
        transition: `background .8s ${EASE}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 9, letterSpacing: ".26em", color: g.hue }}>{meta.eyebrow}</span>
        <span style={{ marginLeft: "auto" }}>
          <GodIcon icon={g.icon} color={g.hue} size={15} />
        </span>
      </div>
      <div style={{ height: 150, display: "flex", justifyContent: "center", alignItems: "flex-end", marginTop: 10 }}>
        <Statue src={meta.src} god={g} height={144} treatment={meta.treatment} animate="none" />
      </div>
      <h3
        style={{
          margin: "12px 0 0",
          fontFamily: "'Fraunces',Georgia,serif",
          fontWeight: 420,
          fontSize: 23,
          letterSpacing: ".08em",
          color: dim ? SLATE : INK,
        }}
      >
        {g.name}
      </h3>
      <div style={{ width: 26, height: 1, background: g.hue, margin: "8px 0" }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 8.5, letterSpacing: ".2em", color: dim ? MIST : SLATE }}>{g.domain}</span>
        <span style={{ marginLeft: "auto", fontFamily: "'Fraunces',Georgia,serif", fontStyle: "italic", fontSize: 13, color: g.hue }}>
          {roman(done)} / {roman(total)}
        </span>
      </div>
    </div>
  );
}

function HallRow({ hall, onOpen }: { hall: (typeof HALLS)[number]; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 28,
        borderTop: `1px solid ${STONE}`,
        borderBottom: hall.last ? `1px solid ${STONE}` : undefined,
        padding: "26px 8px",
        cursor: "pointer",
        background: hover ? PANEL : "transparent",
        transition: `background .8s ${EASE}`,
      }}
    >
      <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 13, letterSpacing: ".3em", color: GOLD, width: 36 }}>{hall.num}</span>
      <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 390, fontSize: 36, color: INK, transition: "color .8s" }}>{hall.title}</span>
      <span style={{ marginLeft: "auto", fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontSize: 16, color: MIST }}>{hall.tag}</span>
      <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 14, color: GOLD }}>—</span>
    </div>
  );
}

function VeilLink({ onOpen }: { onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontFamily: "'Cormorant SC',serif",
        fontSize: 10,
        letterSpacing: ".3em",
        color: hover ? GOLD : MIST,
        transition: "color .7s",
      }}
    >
      BEHIND THE VEIL —
    </button>
  );
}
