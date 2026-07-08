import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Council } from "./screens/Council.js";
import { FirstMeeting } from "./screens/FirstMeeting.js";
import { Forge } from "./screens/Forge.js";
import { Loom } from "./screens/Loom.js";
import { Observatory } from "./screens/Observatory.js";
import { Olympus } from "./screens/Olympus.js";
import { Veil } from "./screens/Veil.js";
import { WeeklyCouncil } from "./screens/WeeklyCouncil.js";
import { ProvingGround } from "./components/ProvingGround.js";
import { API_URL } from "./lib/api.js";
import { MotionProvider } from "./motion/MotionProvider.js";
import { screenVariants } from "./motion/ease.js";
import { Cursor } from "./components/Cursor.js";

type View = "onboarding" | "olympus" | "council" | "loom" | "observatory" | "forge" | "weekly" | "proving";

const MENU: Array<{ view: View; label: string }> = [
  { view: "olympus", label: "Olympus" },
  { view: "council", label: "The Council" },
  { view: "loom", label: "The Loom" },
  { view: "observatory", label: "The Observatory" },
  { view: "forge", label: "The Forge" },
  { view: "weekly", label: "The Weekly Council" },
  { view: "proving", label: "The Proving Ground" },
  { view: "onboarding", label: "The First Meeting" },
];

export function App() {
  const [view, setView] = useState<View>("olympus");
  const [booted, setBooted] = useState(false);
  const [veilOpen, setVeilOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // First-ever open (no Scroll) → the First Meeting.
  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/onboarding/status`)
      .then((r) => r.json())
      .then((s: { needed?: boolean }) => {
        if (alive && s.needed) setView("onboarding");
      })
      .catch(() => {})
      .finally(() => alive && setBooted(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setVeilOpen((v) => !v);
      } else if (e.key === "Escape") {
        setVeilOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (v: string) => {
    if (v === "veil") setVeilOpen(true);
    else setView(v as View);
    setMenuOpen(false);
  };

  if (!booted) return <div className="min-h-screen bg-void" />;

  const screen: ReactNode =
    view === "onboarding" ? (
      <FirstMeeting onComplete={() => setView("olympus")} />
    ) : view === "olympus" ? (
      <Olympus onNavigate={go} />
    ) : view === "council" ? (
      <Council />
    ) : view === "loom" ? (
      <Loom />
    ) : view === "observatory" ? (
      <Observatory onReturn={() => setView("olympus")} />
    ) : view === "forge" ? (
      <Forge />
    ) : view === "weekly" ? (
      <WeeklyCouncil />
    ) : (
      <ProvingGround />
    );

  return (
    <MotionProvider>
    <div className="min-h-screen bg-bone text-obsidian">
      <AnimatePresence mode="wait">
        <motion.div key={view} variants={screenVariants} initial="hidden" animate="show" exit="exit">
          {screen}
        </motion.div>
      </AnimatePresence>

      {/* compact corner menu — unobtrusive over the full-bleed designs */}
      {view !== "onboarding" && (
        <div className="fixed left-3 top-4 z-[70]">
          <button
            onClick={() => setMenuOpen((m) => !m)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="font-label text-[15px] text-gold transition hover:text-goldhover"
            data-cursor="menu"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              lineHeight: 1,
            }}
          >
            {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
          {menuOpen && (
            <div
              className="mt-3 flex flex-col gap-1 border border-stone bg-ivory/95 p-3 backdrop-blur"
              style={{ boxShadow: "0 30px 60px -30px rgba(20,19,26,.4)" }}
            >
              <span
                className="font-label text-gold"
                style={{ fontSize: 11, letterSpacing: "0.34em", padding: "2px 10px 8px" }}
              >
                MAXWELL
              </span>
              {MENU.map((m) => (
                <button
                  key={m.view}
                  onClick={() => go(m.view)}
                  className="text-left font-label text-[12px] uppercase tracking-[0.24em] transition"
                  style={{ color: view === m.view ? "#C6A15B" : "#14131A", padding: "6px 10px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#C6A15B")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = view === m.view ? "#C6A15B" : "#14131A")}
                >
                  {m.label}
                </button>
              ))}
              <div className="my-1 h-px bg-stone" />
              <button
                onClick={() => go("veil")}
                className="text-left font-mono text-[11px] text-mist transition hover:text-gold"
                style={{ padding: "6px 10px" }}
              >
                ⌘. Behind the Veil
              </button>
            </div>
          )}
        </div>
      )}

      <Veil open={veilOpen} onClose={() => setVeilOpen(false)} />
      <Cursor />
    </div>
    </MotionProvider>
  );
}
