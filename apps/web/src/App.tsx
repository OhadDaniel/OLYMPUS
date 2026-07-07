import { useEffect, useState } from "react";
import { Council } from "./screens/Council.js";
import { FirstMeeting } from "./screens/FirstMeeting.js";
import { Forge } from "./screens/Forge.js";
import { Loom } from "./screens/Loom.js";
import { Observatory } from "./screens/Observatory.js";
import { Olympus } from "./screens/Olympus.js";
import { Veil } from "./screens/Veil.js";
import { WeeklyCouncil } from "./screens/WeeklyCouncil.js";
import { ProvingGround } from "./components/ProvingGround.js";
import { useLenis } from "./lib/useLenis.js";

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
  useLenis();
  const [view, setView] = useState<View>("olympus");
  const [veilOpen, setVeilOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-bone text-obsidian">
      {view === "onboarding" ? (
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
      )}

      {/* compact corner menu — unobtrusive over the full-bleed designs */}
      {view !== "onboarding" && (
        <div className="fixed left-5 top-5 z-[70]">
          <button
            onClick={() => setMenuOpen((m) => !m)}
            className="font-label text-[11px] uppercase tracking-[0.3em] text-gold transition hover:text-goldhover"
            style={{ mixBlendMode: "normal" }}
          >
            {menuOpen ? "✕ CLOSE" : "☰ MAXWELL"}
          </button>
          {menuOpen && (
            <div
              className="mt-3 flex flex-col gap-1 border border-stone bg-ivory/95 p-3 backdrop-blur"
              style={{ boxShadow: "0 30px 60px -30px rgba(20,19,26,.4)" }}
            >
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
    </div>
  );
}
