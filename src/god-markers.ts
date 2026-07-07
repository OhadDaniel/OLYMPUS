import type { AgentEvent } from "./events.js";
import { isGodId } from "./pantheon.js";

/**
 * The persona emits `[god:athena]` to open a domain passage. The harness strips
 * these from the visible token stream and turns each into a `god` event so the
 * UI restyles (the "god steps forward" beat). Markers can straddle streaming
 * chunk boundaries, so this is a small stateful parser.
 */

const MARKER_RE = /^\[god:([a-z]+)\]/;
// Is the buffer a possible in-progress prefix of "[god:<id>]"?  e.g. "[", "[go", "[god:a"
const PREFIX_RE = /^\[(g(o(d(:[a-z]*)?)?)?)?$/;

export interface GodMarkerStripper {
  push(text: string): void;
  flush(): void;
}

export function createGodMarkerStripper(emit: (event: AgentEvent) => void): GodMarkerStripper {
  let buf = "";

  function drain(final: boolean): void {
    while (buf.length > 0) {
      const open = buf.indexOf("[");
      if (open === -1) {
        emit({ type: "token", text: buf });
        buf = "";
        return;
      }
      if (open > 0) {
        emit({ type: "token", text: buf.slice(0, open) });
        buf = buf.slice(open);
      }

      // buf now starts with "["
      const match = MARKER_RE.exec(buf);
      if (match) {
        const id = match[1]!;
        if (isGodId(id)) emit({ type: "god", godId: id });
        else emit({ type: "token", text: match[0] }); // not a real god — pass through
        buf = buf.slice(match[0].length);
        continue;
      }

      // Not a complete marker. If it could still become one, wait for more.
      if (!final && PREFIX_RE.test(buf)) return;

      // Can't be a marker (or we're flushing): emit the "[" and re-scan.
      emit({ type: "token", text: "[" });
      buf = buf.slice(1);
    }
  }

  return {
    push(text: string) {
      buf += text;
      drain(false);
    },
    flush() {
      drain(true);
    },
  };
}

/** Pure helper: remove valid god markers from a finished string. */
export function stripGodMarkers(text: string): string {
  return text.replace(/\[god:([a-z]+)\]/g, (whole, id: string) => (isGodId(id) ? "" : whole));
}
