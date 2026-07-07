import { useState } from "react";
import type { GodDesign } from "../lib/design.js";
import { GodIcon } from "./GodIcon.js";

/**
 * A god statue. Uses the supplied render from /assets when present; until the
 * Midjourney renders are dropped in, falls back to a marble plate with the god's
 * icon so layouts hold. `treatment`: "cutout" (multiply, transparent) vs "plate"
 * (framed grayscale) per the handoff's texture notes.
 */
export function Statue({
  src,
  god,
  height = 244,
  treatment = "cutout",
  animate = "mxFloat 9s ease-in-out infinite",
}: {
  src?: string;
  god: GodDesign;
  height?: number;
  treatment?: "cutout" | "plate" | "dark";
  animate?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    const filter =
      treatment === "plate"
        ? "grayscale(1) contrast(1.05)"
        : treatment === "dark"
          ? "brightness(1.02)"
          : "brightness(1.16) contrast(1.04)";
    return (
      <img
        src={`/assets/${src}`}
        alt={god.name}
        onError={() => setFailed(true)}
        style={{
          height,
          width: treatment === "plate" ? "100%" : undefined,
          objectFit: treatment === "plate" ? "cover" : undefined,
          mixBlendMode: treatment === "cutout" ? "multiply" : "normal",
          border: treatment === "plate" ? "1px solid var(--color-stone)" : undefined,
          filter,
          animation: treatment === "cutout" ? animate : undefined,
        }}
      />
    );
  }

  // Fallback plate — reads as "a statue belongs here".
  return (
    <div
      style={{ height, width: "100%", animation: treatment === "cutout" ? animate : undefined }}
      className="flex items-end justify-center"
    >
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3"
        style={{
          background: "linear-gradient(160deg, #ECE7DB, #D8D0C0)",
          border: "1px solid var(--color-stone)",
          filter: "grayscale(0.4)",
        }}
      >
        <GodIcon icon={god.icon} color={god.hue} size={44} />
        <span className="font-label text-[10px] tracking-[0.3em] text-mist">{god.name}</span>
      </div>
    </div>
  );
}
