import type { GodId } from "./types.js";

/**
 * The pantheon — the product's SINGLE identity system. One god = one hue
 * EVERYWHERE (Loom blocks, chat step-forward, radar axis, Observatory stars,
 * Olympus flame). This module is PURE DATA (no node/config imports) so the web
 * app can import it directly for styling.
 */
export interface GodConfig {
  id: GodId;
  /** Display name (Maxwell is Zeus). */
  name: string;
  domain: string;
  /** The one hue. */
  accent: string;
  /** Dim/grayscale-before-awakening variant. */
  dim: string;
  symbol: string;
  /** One-line voice, mirrored into the persona markdown. */
  voice: string;
}

export const GODS: Record<GodId, GodConfig> = {
  zeus: {
    id: "zeus",
    name: "Maxwell",
    domain: "Orchestrator — the only default voice",
    accent: "#F2D680",
    dim: "#4A5568",
    symbol: "lightning",
    voice: "Warm, sovereign, concise; dry wit; never sycophantic",
  },
  athena: {
    id: "athena",
    name: "Athena",
    domain: "Career",
    accent: "#7C8CA6",
    dim: "#3E4756",
    symbol: "owl",
    voice: "Strategic, precise, mentor-to-a-hero; asks the sharp question",
  },
  asclepius: {
    id: "asclepius",
    name: "Asclepius",
    domain: "Health",
    accent: "#4F8C82",
    dim: "#2E4B46",
    symbol: "serpent staff",
    voice: "Calm clinician-coach; protective of sleep",
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    domain: "Tasks & admin",
    accent: "#34A8A0",
    dim: "#1F5B57",
    symbol: "winged sandal",
    voice: "Quick, playful; hates open loops",
  },
  hestia: {
    id: "hestia",
    name: "Hestia",
    domain: "Family & friends",
    accent: "#E2823C",
    dim: "#7A4620",
    symbol: "hearth flame",
    voice: "Warm, unhurried; remembers names and dates",
  },
  apollo: {
    id: "apollo",
    name: "Apollo",
    domain: "Self-improvement",
    accent: "#E8A33D",
    dim: "#7E5A23",
    symbol: "laurel",
    voice: "Luminous, aspirational; Delphic maxims sparingly",
  },
};

export const GOD_IDS = Object.keys(GODS) as GodId[];

/** The neutral stone-grey of imported Google events — "the outer world". */
export const OUTER_WORLD = { border: "#3A3542", text: "#726C64" } as const;

export function isGodId(value: string): value is GodId {
  return value in GODS;
}

/** The in-band marker the persona emits to hand a passage to a domain god. */
export function godMarker(godId: GodId): string {
  return `[god:${godId}]`;
}
