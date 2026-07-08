import type { Transition, Variants } from "framer-motion";

/**
 * The ONE easing + duration vocabulary for MAXWELL. Everything animated routes
 * through these so motion feels authored, not ad-hoc. Bezier tuples for
 * framer-motion; matching strings for CSS/GSAP.
 */
export const ease = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number], // expoOut — entrances
  in: [0.7, 0, 0.84, 0] as [number, number, number, number], // expoIn — exits / curtain
  ui: [0.22, 1, 0.36, 1] as [number, number, number, number], // uiOut — hover / micro
};

export const easeCss = {
  out: "cubic-bezier(0.16,1,0.3,1)",
  in: "cubic-bezier(0.7,0,0.84,0)",
  ui: "cubic-bezier(0.22,1,0.36,1)",
};

/** Duration tokens by element mass (seconds). */
export const dur = {
  hero: 1.1,
  content: 0.7,
  micro: 0.28,
  curtainIn: 0.5,
  curtainOut: 0.7,
  intro: 2.0,
};

/** Reserved ONLY for cursor / magnetic matter. */
export const spring: Transition = { type: "spring", stiffness: 150, damping: 15 };

/** Masked-rise reveal (used by RevealText and card groups). */
export const riseParent = (stagger = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: dur.content, ease: ease.out } },
};

/** Page-transition (curtain cross) variants for the routed screen. */
export const screenVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: dur.hero, ease: ease.out } },
  exit: { opacity: 0, y: -14, filter: "blur(6px)", transition: { duration: 0.4, ease: ease.in } },
};
