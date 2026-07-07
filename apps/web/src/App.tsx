import { useEffect, useState } from "react";
import { Council } from "./components/Council.js";
import { Orb } from "./components/Orb.js";
import { Veil } from "./components/Veil.js";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "The night is deep, Ohad.";
  if (h < 12) return "Good morning, Ohad.";
  if (h < 18) return "Good afternoon, Ohad.";
  return "Good evening, Ohad.";
}

export function App() {
  const [veilOpen, setVeilOpen] = useState(false);

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
      <header className="relative shrink-0 border-b border-hairline">
        <Orb />
        <div className="absolute inset-x-0 top-6 text-center">
          <h1 className="font-display text-2xl uppercase tracking-[0.35em] text-gold">Olympus</h1>
        </div>
        <div className="pb-5 text-center">
          <p className="font-display text-xl tracking-wide text-ink">{greeting()}</p>
          <p className="mt-1 font-label text-sm tracking-widest text-ink-3">the council is assembled</p>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Council />
      </main>

      <button
        onClick={() => setVeilOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-hairline bg-s1 px-3 py-1.5 font-mono text-xs text-ink-3 transition hover:text-gold"
        title="Behind the Veil"
      >
        ⌘. veil
      </button>

      <Veil open={veilOpen} />
    </div>
  );
}
