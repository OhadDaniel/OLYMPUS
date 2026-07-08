import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../motion/MotionProvider.js";

/**
 * A single lerped custom cursor with a small state machine: a hard dot that
 * tracks the pointer 1:1, and a ring that trails with inertia and swells when
 * over anything marked [data-cursor] (optionally showing that element's label).
 * Uses mix-blend-mode: difference so it stays visible over light bone and dark
 * void alike. Hidden on touch and under prefers-reduced-motion; native cursor
 * is suppressed only while this is active.
 */
export function Cursor() {
  const reduced = useReducedMotion();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return; // touch → skip
    setEnabled(true);
    document.body.classList.add("mx-has-cursor");

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: target.x, y: target.y };

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
      const hit = (e.target as HTMLElement | null)?.closest?.("[data-cursor]") as HTMLElement | null;
      setActive(Boolean(hit));
      setLabel(hit?.dataset.cursor ?? "");
    };

    let raf = 0;
    const loop = () => {
      ring.x += (target.x - ring.x) * 0.15;
      ring.y += (target.y - ring.y) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      document.body.classList.remove("mx-has-cursor");
    };
  }, [reduced]);

  if (!enabled) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", mixBlendMode: "difference" }}>
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#fff",
          transition: "width .3s, height .3s, opacity .3s",
          opacity: active ? 0 : 1,
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: active ? 64 : 30,
          height: active ? 64 : 30,
          borderRadius: "50%",
          border: "1px solid #fff",
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          transition: "width .4s cubic-bezier(0.16,1,0.3,1), height .4s cubic-bezier(0.16,1,0.3,1), background .4s",
        }}
      >
        {active && label && (
          <span style={{ fontFamily: "'Cormorant SC',serif", fontSize: 8, letterSpacing: "0.24em", color: "#fff", whiteSpace: "nowrap" }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
