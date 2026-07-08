import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The motion spine. One shared clock: Lenis drives smooth scroll, feeds
 * gsap.ticker, and updates ScrollTrigger — so smooth scroll and every
 * scroll-linked animation share a single timeline. Honors prefers-reduced-
 * motion (no smooth scroll, reveals fall back to instant via useReducedMotion).
 */
const ReducedMotionCtx = createContext(false);
export const useReducedMotion = (): boolean => useContext(ReducedMotionCtx);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return; // reduced motion → native scroll, no Lenis
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, touchMultiplier: 1.5 });
    lenis.on("scroll", ScrollTrigger.update);
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, [reduced]);

  return <ReducedMotionCtx.Provider value={reduced}>{children}</ReducedMotionCtx.Provider>;
}
