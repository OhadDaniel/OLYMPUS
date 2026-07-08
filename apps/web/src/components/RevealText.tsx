import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { ease } from "../motion/ease.js";
import { useReducedMotion } from "../motion/MotionProvider.js";

/**
 * The masked rise — MAXWELL's signature heading motion. Splits text into words,
 * each clipped in an overflow-hidden box and lifted translateY(115%→0) on a
 * slow expo-out stagger, so words rise from behind a mask as they scroll in.
 * One primitive buys roughly half the perceived craft jump. Falls back to
 * static text under prefers-reduced-motion.
 */
export function RevealText({
  text,
  className,
  style,
  delay = 0,
  stagger = 0.055,
  once = true,
  block = true,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  stagger?: number;
  once?: boolean;
  block?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <span className={className} style={{ display: block ? "block" : "inline-block", ...style }}>
        {text}
      </span>
    );
  }

  const words = text.split(/(\s+)/); // keep whitespace tokens for natural spacing
  return (
    <motion.span
      className={className}
      style={{ display: block ? "block" : "inline-block", ...style }}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "0px 0px -8% 0px" }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {w}
          </span>
        ) : (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
            <motion.span
              style={{ display: "inline-block", willChange: "transform" }}
              variants={{ hidden: { y: "115%" }, show: { y: "0%" } }}
              transition={{ duration: 0.9, ease: ease.out }}
            >
              {w}
            </motion.span>
          </span>
        ),
      )}
    </motion.span>
  );
}
