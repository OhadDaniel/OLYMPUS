import { useEffect, useState } from "react";
import { Council } from "./components/Council.js";
import { Forge } from "./components/Forge.js";
import { Loom } from "./components/Loom.js";
import { Observatory } from "./components/Observatory.js";
import { Orb } from "./components/Orb.js";
import { ProvingGround } from "./components/ProvingGround.js";
import { Veil } from "./components/Veil.js";

type View = "council" | "loom" | "observatory" | "forge" | "proving";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "The night is deep, Ohad.";
  if (h < 12) return "Good morning, Ohad.";
  if (h < 18) return "Good afternoon, Ohad.";
  return "Good evening, Ohad.";
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-label text-sm uppercase tracking-[0.2em] transition"
      style={{ color: active ? "var(--color-gold)" : "var(--color-ink-3)" }}
    >
      {label}
    </button>
  );
}

export function App() {
  const [veilOpen, setVeilOpen] = useState(false);
  const [view, setView] = useState<View>("council");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setVeilOpen((v) => !v);
      } else if (e.key === "Escape") {
        setVeilOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-s0 text-ink">
      <nav className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
        <span className="font-display text-lg uppercase tracking-[0.3em] text-gold">Maxwell</span>
        <div className="flex gap-6">
          <Tab label="Council" active={view === "council"} onClick={() => setView("council")} />
          <Tab label="The Loom" active={view === "loom"} onClick={() => setView("loom")} />
          <Tab label="Observatory" active={view === "observatory"} onClick={() => setView("observatory")} />
          <Tab label="Forge" active={view === "forge"} onClick={() => setView("forge")} />
          <Tab label="Proving Ground" active={view === "proving"} onClick={() => setView("proving")} />
        </div>
        <button
          onClick={() => setVeilOpen((v) => !v)}
          className="font-mono text-xs text-ink-3 transition hover:text-gold"
          title="Behind the Veil"
        >
          ⌘. veil
        </button>
      </nav>

      <main className="min-h-0 flex-1">
        {view === "council" ? (
          <div className="flex h-full flex-col">
            <header className="relative shrink-0 border-b border-hairline">
              <Orb />
              <div className="pb-4 text-center">
                <p className="font-display text-xl tracking-wide text-ink">{greeting()}</p>
                <p className="mt-1 font-label text-sm tracking-widest text-ink-3">the council is assembled</p>
              </div>
            </header>
            <div className="min-h-0 flex-1">
              <Council />
            </div>
          </div>
        ) : view === "loom" ? (
          <Loom />
        ) : view === "observatory" ? (
          <Observatory />
        ) : view === "forge" ? (
          <Forge />
        ) : (
          <ProvingGround />
        )}
      </main>

      <Veil open={veilOpen} />
    </div>
  );
}
