import type { GodId } from "../../../../src/types.js";

export interface GodDesign {
  id: GodId;
  name: string;
  domain: string;
  hue: string;
  rgb: string; // "r,g,b" for rgba() tints
  numeral: string;
  icon: "crown" | "shield" | "sun" | "wind" | "heart" | "flame";
}

/** The pantheon as the visual language frames it (domains/order/icons per the style guide). */
export const GODS_DESIGN: Record<GodId, GodDesign> = {
  zeus: { id: "zeus", name: "MAXWELL", domain: "COUNSEL & COMMAND", hue: "#C6A15B", rgb: "198,161,91", numeral: "I", icon: "crown" },
  athena: { id: "athena", name: "ATHENA", domain: "STRATEGY & WORK", hue: "#7C8CA6", rgb: "124,140,166", numeral: "II", icon: "shield" },
  apollo: { id: "apollo", name: "APOLLO", domain: "CRAFT & LIGHT", hue: "#E8A33D", rgb: "232,163,61", numeral: "III", icon: "sun" },
  hermes: { id: "hermes", name: "HERMES", domain: "ERRANDS & PASSAGE", hue: "#34A8A0", rgb: "52,168,160", numeral: "IV", icon: "wind" },
  asclepius: { id: "asclepius", name: "ASCLEPIUS", domain: "HEALTH & VITALITY", hue: "#4F8C82", rgb: "79,140,130", numeral: "V", icon: "heart" },
  hestia: { id: "hestia", name: "HESTIA", domain: "HEARTH & HOME", hue: "#E2823C", rgb: "226,130,60", numeral: "VI", icon: "flame" },
};

/** Council frieze order (crown · shield · sun · wind · heart · flame). */
export const GOD_ORDER: GodId[] = ["zeus", "athena", "apollo", "hermes", "asclepius", "hestia"];

export const tint = (rgb: string, alpha: number): string => `rgba(${rgb},${alpha})`;

const ROMAN: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
export function roman(n: number): string {
  let out = "";
  let v = Math.max(0, Math.floor(n));
  for (const [val, sym] of ROMAN) while (v >= val) { out += sym; v -= val; }
  return out || "0";
}

export function greeting(name = "Ohad"): string {
  const h = new Date().getHours();
  const part = h < 5 ? "The night is deep" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}
