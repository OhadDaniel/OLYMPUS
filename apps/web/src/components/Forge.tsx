import { useEffect, useState } from "react";
import { fetchForge, googleAuthUrl, linkTelegram, type ForgeStatus } from "../lib/insight.js";

function Binding({ label, on, action }: { label: string; on: boolean; action?: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-hairline bg-s1 px-4 py-3">
      <span className="font-label tracking-wide text-ink">
        <span style={{ color: on ? "#4F8C82" : "#726C64" }}>{on ? "●" : "○"}</span> {label}
      </span>
      {on ? (
        <span className="text-xs text-ink-3">connected</span>
      ) : action ? (
        <button onClick={action} className="rounded border border-gold/40 px-3 py-1 text-xs uppercase tracking-widest text-gold hover:bg-gold/10">
          Connect
        </button>
      ) : (
        <span className="text-xs text-ink-3">—</span>
      )}
    </div>
  );
}

export function Forge() {
  const [data, setData] = useState<ForgeStatus | null>(null);
  useEffect(() => {
    void fetchForge().then(setData);
  }, []);
  if (!data) return <div className="p-8 text-center text-ink-3">Opening the Forge…</div>;

  const p = data.scroll;
  return (
    <div className="mx-auto max-w-2xl space-y-8 overflow-y-auto p-6">
      <h2 className="font-display text-lg uppercase tracking-[0.25em] text-gold">The Forge</h2>

      <section className="space-y-2">
        <p className="font-label text-sm uppercase tracking-widest text-ink-2">Bindings</p>
        <Binding label="Google (calendar + inbox, read-only)" on={data.bindings.google} action={() => (window.location.href = googleAuthUrl())} />
        <Binding
          label="Telegram"
          on={data.bindings.telegram}
          action={async () => {
            const { url } = await linkTelegram();
            window.open(url, "_blank");
          }}
        />
        <Binding label="MCP world-server" on={data.bindings.mcp} />
      </section>

      <section className="space-y-2">
        <p className="font-label text-sm uppercase tracking-widest text-ink-2">The Scroll · v{data.version}</p>
        <div className="space-y-2 rounded-lg border border-hairline bg-s1 p-4 text-sm">
          <div><span className="text-ink-3">Name:</span> {p.identity?.name ?? "—"} ({p.identity?.timezone ?? "—"})</div>
          <div><span className="text-ink-3">Tone:</span> {p.preferences?.tone ?? "—"} · quiet {p.preferences?.quietHours?.start}–{p.preferences?.quietHours?.end}</div>
          <div><span className="text-ink-3">Chronotype:</span> {p.energyMap?.chronotype ?? "—"}, focus {(p.energyMap?.bestFocus ?? []).join(", ")}</div>
          <div><span className="text-ink-3">Constraints:</span> {(p.constraints ?? []).join("; ") || "—"}</div>
          {p.followThrough && (
            <div>
              <span className="text-ink-3">Follow-through:</span>{" "}
              {Object.entries(p.followThrough)
                .filter(([, v]) => v.scheduled > 0)
                .map(([g, v]) => `${g} ${v.done}/${v.scheduled}`)
                .join(" · ")}
            </div>
          )}
        </div>
      </section>

      {p.learned && p.learned.length > 0 && (
        <section className="space-y-2">
          <p className="font-label text-sm uppercase tracking-widest text-ink-2">
            Maxwell learned {p.learned.length} thing{p.learned.length === 1 ? "" : "s"} about you
          </p>
          <ul className="space-y-1 rounded-lg border border-hairline bg-s1 p-4 text-sm text-ink-2">
            {p.learned.map((l, i) => (
              <li key={i}>· {l.insight}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
