# MAXWELL — a Greek-pantheon AI life-assistant

> Capstone for a 6-workshop agentics course, and a real daily tool for its single user.
> A council of gods — **Maxwell (Zeus)** orchestrating five domain gods — designs and runs
> your life week by week. The schedule of record lives *in the app* (the Loom); Google
> Calendar and Gmail enter **read-only** through an MCP server we authored; rhythm runs over
> real Telegram; a weekly multi-agent council redesigns each cycle; eight runtime skills power
> every flow; the Scroll learns you week over week.

---

## The pantheon

| God | Domain | Hue |
|---|---|---|
| **Maxwell / Zeus** | orchestrator — the only default voice | gold |
| **Athena** | career | slate-blue |
| **Asclepius** | health | teal-green |
| **Hermes** | tasks & admin | cyan |
| **Hestia** | family & friends | amber |
| **Apollo** | self-improvement | gold-amber |

One god = one hue **everywhere** — the Loom blocks, chat when a god steps forward, the
Observatory radar, the god-flames on Olympus.

---

## Architecture

```
apps/web   React 18 + Vite + Tailwind v4          (Olympus · Council · Loom · Observatory · Forge · Veil)
   │  SSE + JSON/HTTP
apps/api   NestJS (run under tsx)
   ├── ChatModule       POST /chat  → SSE of HarnessEvents   (imports runAgentLoop — never forks it)
   ├── CouncilModule    POST /council/start → 5 god subagents in parallel → synthesis → next-cycle proposal
   ├── LoomModule       GET /loom/week · Proposals approve/reject → apply to the in-app schedule
   ├── AuthModule       GET /auth/google (+callback) → refresh token (calendar.readonly + gmail.readonly)
   ├── TelegramModule   grammY long-polling: /start deep-link linking · relay · check-in buttons
   ├── RhythmModule     @nestjs/schedule crons: 07:05 brief · 21:30 check-in · 02:00 consolidation
   ├── OnboardingModule the First Meeting backend (interview · wheel · bridge · verifier)
   ├── InsightModule    GET /observatory · GET /forge/status
   └── VeilModule       GET /veil/stream → SSE of every harness event
src/       Shared core (imported by api, mcp, scripts — one loop, one registry, one config)
   ├── loop.ts          runAgentLoop — THE agent loop (turn loop · gate · streaming · audit)
   ├── openai.ts        gpt-4o client · completeWithTools + streaming · serializeAssistantMessage
   ├── structured.ts    forced-tool strict structured outputs (+ one retry)
   ├── events.ts        HarnessEvent bus (per-run) · god-markers.ts (streaming [god:x] parser)
   ├── config.ts        the ONLY place process.env is read (zod, fail-fast)
   ├── pantheon.ts      god identity system  ·  system-prompt.ts  ·  prompts/maxwell.system.md
   ├── scheduling/      placer.ts + differ.ts (pure, unit-tested) · week.ts · apply.ts · intents.ts
   ├── tools/           registry.ts + one file per tool + mcp-client.ts (source:'native'|'mcp')
   ├── skills/loader.ts 3-level runtime skill loading
   ├── council.ts       GodReport fan-out + synthesis + intent merge
   ├── workflows/       guardrails.ts (the gate) · first-meeting.ts · verify-first-meeting.ts · consolidation.ts
   └── db/              mongoose connection + 16 models
mcp/world-server.ts     our OWN read-only MCP stdio server: Google Calendar + Gmail (zero write tools)
skills/                 the eight product skills — SKILL.md playbook + deterministic scripts each
```

**Laws (enforced, not aspirational):** one loop · one registry · one config path · model
proposes / harness executes (every side effect through `dispatchTool` with zod validation) ·
persona lives in markdown · no LangChain/CrewAI · users never see JSON logs (file sink only) ·
OpenAI strict tools (every property in `required`, optionals nullable) · ESM + strict TS.

---

## The concept map — every workshop, load-bearing

- **W1 — hand-rolled harness (no framework):** `src/loop.ts` is ~200 lines of typed turn loop over
  OpenAI Chat Completions — streaming, tool dispatch, error taxonomy, run records. Nothing forks it.
- **W2 — runtime skills:** eight named skills in `skills/`, 3-level loading (catalog → `load_skill` →
  scripts). Playbooks in markdown, determinism in scripts (`placer.ts`, `differ.ts`, verifiers). Every
  load emits a `skill` event you can watch in the Veil.
- **W3 — authored MCP + gated writes:** `mcp/world-server.ts` is our own read-only MCP server; the
  outside world enters as `<untrusted>` data; the **gate** (`guardrails.ts`) makes `apply_proposal`
  always require a human tap — the model literally cannot mutate the schedule. Every crossing is an
  `AgentAction` audit row.
- **W4 — cron autonomy on a real phone:** RhythmModule fires the morning brief and evening check-in to
  Telegram, wrapped in a `Job` idempotency ledger.
- **W5 — true multi-agent council:** five god subagents run in `Promise.all`, each forced to a strict
  `GodReport`; Zeus synthesizes (wins → data → tips → feedback) and proposes the next cycle.
- **W6 — a real product:** the First Meeting, the Loom, the Scroll that learns you (`learned[]`,
  `followThrough` computed from check-ins).

## Why this wins (the judge's-eye view)

1. **The architecture is on screen.** Press **⌘.** for *Behind the Veil* — the loop, risk tiers,
   the permission gate, MCP-vs-native badges, active skills, and parallel god subagents, live.
2. **Security by architecture, not by prompt.** Calendar/Gmail are read-only through an MCP server
   with zero write tools; the only write path to the schedule is a human tap; the gate is unit-tested
   (`apply_proposal` is always gated, regardless of risk class).
3. **The emotional layer is engineered:** per-god identity system, streaming presence, god step-forward,
   ritual design (First Meeting → daily rhythm → weekly council), an honesty-rewarding candor streak.
4. **It closes the loop:** interview → design → live on the phone → check-ins → data → feedback → next
   week is measurably smarter (the Scroll's `learned[]`, shown in the Forge).

---

## Setup

```bash
npm install
cp .env.example .env      # fill in the values below
docker: none — MongoDB is Atlas (M0, free)
```

`.env` (all secrets gitignored):

```
OPENAI_API_KEY=            # gpt-4o
MONGODB_URI=               # MongoDB Atlas M0 SRV string (db name: maxwell)
GOOGLE_CLIENT_ID=          # Cloud console; redirect http://localhost:3011/auth/google/callback
GOOGLE_CLIENT_SECRET=
TELEGRAM_BOT_TOKEN=        # @BotFather /newbot
APP_URL=http://localhost:5273
API_URL=http://localhost:3011
```

```bash
npm run dev:api      # NestJS API on :3011 (spawns the MCP world-server)
npm run dev:web      # Vite web on :5273
npm run repl         # dev REPL against the loop (logs → file, clean stdout)
npm run typecheck    # tsc, must pass
npm run test         # vitest: placer, differ, the gate
npm run seed:demo    # 3 weeks of believable history  ·  npm run seed:wipe
```

> Ports are **3011 / 5273** (not the SPEC's 3001 / 5173) to avoid colliding with another local app.

---

## Demo path (7 beats)

1. **Olympus** loads — dark marble, a breathing gold orb, "Good evening, Ohad."
2. **The Council** — "How does my week look?" streams instantly; a domain god steps forward with its
   accent + nameplate.
3. **The Loom** — "design me a week" → a proposal **diff** (gold-dashed adds) → **Approve** → the
   schedule updates over the imported outer-world events.
4. **The phone** — trigger the evening check-in; ✅/↷/✕ buttons on Telegram update the app live.
5. **The Weekly Council** — five god cards work in parallel → Zeus synthesizes data + tips + asks for
   feedback → proposes next week as one diff.
6. **⌘. Behind the Veil** — the live harness event stream: tool calls, risk tiers, the gate, MCP badges,
   active skills, subagent lifecycle.
7. **The Observatory** — the week as a starfield, the life-wheel radar (baseline vs now), the candor flame.

Bonus: "how did it learn me?" → the First Meeting's email scan surfaced commitments from the inbox.

---

## Status

Days 1–3 are built and verified (`npm run typecheck` + `npm run test` green; core flows smoke-tested
end-to-end). The Observatory / Forge / First-Meeting-ritual **UIs are functional but plain** — they're
being reskinned from dedicated designs; the wiring and data are done. Google + Telegram verify live
once the one-time consent / link is completed.
