import { useRef, useState } from "react";
import { streamChat, type ChatFrame } from "../lib/api.js";
import { GODS } from "../../../../src/pantheon.js";
import type { GodId } from "../../../../src/types.js";

interface Segment {
  god?: GodId;
  tokens: string[];
}
interface ChatMsg {
  role: "user" | "assistant";
  segments: Segment[];
}

function GodNameplate({ godId }: { godId: GodId }) {
  const g = GODS[godId];
  return (
    <div className="mb-1 flex items-center gap-2" style={{ animation: "stepForward 0.3s ease-out both" }}>
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: g.accent, boxShadow: `0 0 8px ${g.accent}` }}
      />
      <span className="font-display text-[11px] uppercase tracking-[0.22em]" style={{ color: g.accent }}>
        {g.name}
      </span>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: ChatMsg }) {
  return (
    <div className="max-w-[80%] self-start">
      {msg.segments.map((seg, i) => {
        const accent = seg.god ? GODS[seg.god].accent : undefined;
        return (
          <div
            key={i}
            className={seg.god ? "my-1 border-l-2 pl-3" : ""}
            style={seg.god ? { borderColor: `${accent}88` } : undefined}
          >
            {seg.god && <GodNameplate godId={seg.god} />}
            <p className="leading-relaxed" style={seg.god ? { color: accent } : undefined}>
              {seg.tokens.map((t, j) => (
                <span key={j} className="tok">
                  {t}
                </span>
              ))}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Council() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }));

  const editLastAssistant = (updater: (m: ChatMsg) => ChatMsg) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = prev.slice();
      const last = copy[copy.length - 1]!;
      if (last.role !== "assistant") return prev;
      copy[copy.length - 1] = updater(last);
      return copy;
    });
  };

  const onFrame = (frame: ChatFrame) => {
    switch (frame.type) {
      case "session":
        sessionId.current = frame.id;
        break;
      case "token":
        editLastAssistant((m) => {
          const segs = m.segments.slice();
          const last = { ...segs[segs.length - 1]! };
          last.tokens = [...last.tokens, frame.text];
          segs[segs.length - 1] = last;
          return { ...m, segments: segs };
        });
        scrollDown();
        break;
      case "god":
        editLastAssistant((m) => ({ ...m, segments: [...m.segments, { god: frame.godId, tokens: [] }] }));
        break;
      case "status":
        setStatus(frame.text);
        break;
      case "error":
        editLastAssistant((m) => {
          const segs = m.segments.slice();
          const last = { ...segs[segs.length - 1]! };
          last.tokens = [...last.tokens, `⚠ ${frame.message}`];
          segs[segs.length - 1] = last;
          return { ...m, segments: segs };
        });
        break;
      case "done":
      case "__end__":
        setStatus(null);
        setStreaming(false);
        break;
      default:
        break;
    }
  };

  const send = async () => {
    const message = input.trim();
    if (!message || streaming) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", segments: [{ tokens: [message] }] },
      { role: "assistant", segments: [{ tokens: [] }] },
    ]);
    setStreaming(true);
    setStatus("Maxwell is considering…");
    scrollDown();
    try {
      await streamChat({ message, sessionId: sessionId.current }, onFrame);
    } catch (e) {
      onFrame({ type: "error", message: e instanceof Error ? e.message : "connection lost" });
      setStreaming(false);
      setStatus(null);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="mt-10 text-center">
            <p className="font-label text-lg tracking-widest text-ink-2">The council is listening.</p>
            <p className="mt-2 text-sm text-ink-3">Ask how your week looks, or what you should tend to first.</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-s2 px-4 py-2 text-ink">
                {m.segments[0]?.tokens.join("")}
              </p>
            </div>
          ) : (
            <div key={i} className="flex">
              <AssistantBubble msg={m} />
            </div>
          ),
        )}
        {streaming && status && (
          <div className="pl-1">
            <span className="shimmer-text font-label text-sm tracking-wide">{status}</span>
          </div>
        )}
      </div>

      <div className="border-t border-hairline px-2 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Speak to the council…"
            className="max-h-40 flex-1 resize-none rounded-xl border border-hairline bg-s1 px-4 py-3 text-ink placeholder:text-ink-3 focus:border-gold/50 focus:outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={streaming || !input.trim()}
            className="rounded-xl border border-gold/40 bg-gold/10 px-5 py-3 font-label uppercase tracking-widest text-gold transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
