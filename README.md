# MAXWELL

**A first-principles agent harness with a human-gated write boundary, authored MCP integration, parallel subagents, and an offline regression gate — shipped as a real product.**

Live: [maxwell-app-nu.vercel.app](https://maxwell-app-nu.vercel.app) · Repo: [github.com/OhadDaniel/OLYMPUS](https://github.com/OhadDaniel/OLYMPUS)

```bash
npm install && npm test && npm run eval
# 17/17 unit tests · 55/55 Proving Ground (no secrets, no API calls)
```

---

## What this is

MAXWELL is a single-user life-orchestration agent: a multi-turn loop that reads a real calendar and inbox (read-only), proposes schedule changes as diffs, and **cannot** apply them without a human tap. It runs headless rhythms on Telegram, consolidates memory nightly, and fans out five structured subagent calls for a weekly council.

It is also a deliberate answer to a question I kept asking while building agents:

> *How do you make an agent feel autonomous while making high-stakes writes structurally impossible for the model to perform on its own initiative?*

This repo is my answer — in code, tests, and evals.

---

## Design thesis

| Principle | Implementation |
|-----------|----------------|
| **Model proposes, harness executes** | Every side effect goes through `registry.dispatch()` with zod validation — never direct SDK mutation |
| **One loop** | `src/loop.ts` — no LangChain, no CrewAI, no forked orchestrators |
| **Gate is code, not prompt** | `requiresApproval()` + `ALWAYS_GATED` on `apply_proposal` — proven adversarially |
| **Outer world is read-only** | Authored MCP stdio server — zero write tools, untrusted-input fencing |
| **No LLM arithmetic** | Scheduling is pure `placer.ts` + `differ.ts` — intents in, datetimes out |
| **Observable by default** | Per-run event bus → SSE (Veil) + JSONL file log + `AgentAction` audit ledger |
| **Persona is data** | `prompts/maxwell.system.md` — never inlined in code |

---

## The harness

```
User prompt
    ↓
runAgentLoop (while true, max 8 turns)
    ↓
OpenAI gpt-4o → tool_calls or final text
    ↓
requiresApproval? ──yes──→ tool_gate → "BLOCKED: awaiting user approval"
    ↓ no
zod.validate(args) → registry.dispatch() → AgentAction audit row
    ↓
tool result appended to history → next turn
    ↓
done (stream ends)

Human Approve button → apply_proposal.execute() OUTSIDE the loop
```

**Entry point:** `apps/api/src/core/harness.service.ts` → `src/loop.ts`

Streaming first token is prioritized: context (Scroll summary, Loom snapshot) is pre-fetched in the API layer before the loop starts — no mandatory tool round-trip to begin speaking.

---

## Tools (11 in one registry)

**Native** (`src/tools/`)

| Tool | Risk | Role |
|------|------|------|
| `load_skill` | read | Runtime playbook loading |
| `get_scroll` / `get_week` | read | Profile + schedule ground truth |
| `remember` / `recall` | write / read | Durable facts with life-area tags |
| `propose_week` / `propose_edit` | write | Creates proposal diff only |
| `apply_proposal` | **destructive** | **Always gated** — human path only |

**MCP** (`mcp/world-server.ts` → `src/tools/mcp-client.ts`)

| Tool | Role |
|------|------|
| `world_calendar_events` | Google Calendar (read-only) |
| `world_freebusy` | Busy ranges |
| `world_email_scan` | Gmail snippets — wrapped `<untrusted>` |

OpenAI strict mode throughout: every property in `required`, optionals nullable.

---

## Safety & control

The schedule of record lives in MongoDB (`blocks`). Google is never written.

- **`apply_proposal` ∈ `ALWAYS_GATED`** — gated even if policy is emptied or risk is downgraded (`src/workflows/guardrails.ts`)
- **Chat loop denies all approvals** — `approve: async () => false` in `HarnessService`
- **Injection defense** — calendar titles, email bodies, Telegram text wrapped as data (`src/security.ts`)
- **Momus** — grounded pre-human critique: calendar collisions, quiet hours, goal relevance, self-overlaps (`src/workflows/momus.ts`)

**Proving Ground** (`npm run eval` → `src/evals/suites.ts`):

| Suite | Cases | Proves |
|-------|-------|--------|
| `gate` | 6/6 | Model cannot write schedule on its own |
| `injection` | 4/4 | Untrusted outer-world text cannot reach a write |
| `scheduler` | 41/41 | Placer never overlaps, breaks constraints, or silently drops |
| `council-feasibility` | 4/4 | Merged god intents are actually placeable |

Regression gate: CI fails below **90%**. Current: **55/55 (100%)**.

---

## Multi-agent (honest architecture)

Two machines — the system knows which is which:

| Mode | Mechanism | When |
|------|-----------|------|
| **Persona masks** | One loop; `[god:x]` markers stripped in stream → UI restyle | Everyday chat |
| **Parallel subagents** | `Promise.all(COUNCIL_GODS.map(runGod))` — five structured LLM calls + Zeus synthesis | Weekly Council |

Each god subagent receives real adherence numbers, goals, and memories via `prepareCouncil()` — **no LLM math on stats**. Failed god → `null`, council continues.

---

## Autonomy & memory

**Headless crons** (`apps/api/src/rhythm/rhythm.service.ts`) — idempotent via `Job` ledger:

| Cron | Behavior |
|------|----------|
| 07:05 | Morning brief (Telegram) |
| 21:30 | Evening check-in (Done / Moved / Skipped) |
| 02:00 | Consolidation — followThrough recomputed in code, episodes → Scroll lessons |
| Sat 10:00 | Council nudge |

**The Scroll** — versioned profile in MongoDB. Written only through validated tools. Read before every chat (`buildContext`), on demand (`recall`), at council (`prepareCouncil`), and by the placer (constraints as law).

**Eight runtime skills** (`skills/*/SKILL.md`) — 3-level loader: catalog → `load_skill` → scripts. Playbooks for the model; determinism in code.

---

## Observability

Three intentional layers:

1. **Live events** — `src/events.ts` → SSE to chat + Behind the Veil (⌘.)
2. **File log** — `logs/harness-YYYY-MM-DD.jsonl` (users never see JSON in the UI)
3. **Audit ledger** — `AgentAction` — every tool call, risk, decision (`allowed` / `gated` / `denied`)

Event types include: `token`, `tool_start`, `tool_gate`, `tool_result`, `skill`, `subagent`, `self_check`, `proposal`, `usage`, `done`, `error`.

---

## Architecture

```
apps/web     React + Vite + SSE
     ↓
apps/api     NestJS (tsx) — Chat · Council · Loom · Rhythm · Telegram · Veil
     ↓
src/         Shared core — loop · registry · scheduling · council · workflows · db
     ↓
OpenAI gpt-4o · MongoDB Atlas · MCP world-server (stdio) · Telegram (grammY)
```

**Laws:** one loop · one registry · one config path (`src/config.ts`) · ESM strict TypeScript · zod at every boundary.

---

## Quick start

```bash
npm install
cp .env.example .env   # OPENAI_API_KEY, MONGODB_URI, Google OAuth, TELEGRAM_BOT_TOKEN
npm run dev:api        # :3011 (spawns MCP world-server)
npm run dev:web        # :5273
```

```bash
npm run typecheck      # must pass
npm run test           # 17/17 — placer, differ, guardrails
npm run eval           # 55/55 — Proving Ground
npm run repl           # loop REPL, logs → file
npm run seed:demo      # 3 weeks of history
```

Ports **3011 / 5273** (avoid local collisions). MongoDB Atlas M0 — no Docker.

---

## What I would do differently at scale

Honest tradeoffs visible in this build:

- **`learned[]` appends without pruning** — compounding moat for one user; production needs re-consolidation or rolling window
- **Morning brief is template-based** — deterministic today; LLM-composed brief is the next increment
- **`update_scroll` tool specified but not yet in registry** — profile updates flow through `remember` + consolidation
- **Weekly Council UI is functional, not final** — backend SSE + parallel fan-out is complete

I ship the invariant first, then the polish.

---

## Why I built it this way

Framework orchestrators hide the decisions that matter: where the gate lives, what gets logged, what happens when a tool throws, whether the model can write. I wanted those decisions **explicit, typed, and testable**.

So I wrote ~200 lines of loop, a registry factory, a pure approval function, a placer with property tests, and an eval harness that red-teams the claims — not just the happy path. Then I wrapped it in a product I actually use daily.

If you're evaluating this repo as a signal of how I build agents: start at `src/loop.ts`, `src/workflows/guardrails.ts`, `src/evals/suites.ts`, and run `npm run eval`.

---

## Demo path

1. **Council** — "How does my week look?" → streaming + tool calls
2. **⌘. Veil** — live harness: risk tiers, gate, MCP badges, subagent lifecycle
3. **Loom** — proposal diff → Approve → schedule updates over imported Google events
4. **Telegram** — evening check-in buttons update block status
5. **Weekly Council** — five god cards parallel → Zeus synthesis → one proposal

---

**Built by [Ohad Daniel](https://github.com/OhadDaniel)** — agentics capstone, MasterSchool.  
Questions, architecture walkthroughs, or eval deep-dives welcome in Issues.

