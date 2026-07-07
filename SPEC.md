# MAXWELL — Capstone Build Spec v3.1 (fresh repo · 3-day sprint)

> **For the building agent:** This is a NEW project in an empty repo. Read `CLAUDE.md` first, then execute this spec **day by day, in order**. Every stack decision is final — do not re-open choices. P0 = must ship · P1 = if on schedule · P2 = stretch. When ambiguous, prefer whatever keeps the Demo Path (§1) green.
>
> **Sibling repo:** `/Users/ohaddaniel/maxwell` holds the owner's Workshop 1–2 assets (a proven CLI harness: loop, tool registry, guardrails, verifier, skills-loading). You MAY read it and MAY port its harness core files as the Day-1 seed (recommended — it encodes hard-won lessons). Never modify that repo.

---

## 0. What Maxwell is

A premium AI life-assistant web app — the capstone of a 6-workshop agentics course (demo day in 3 days) AND a real daily tool for its single user, Ohad. A council of agents themed as Greek gods — **Maxwell (Zeus)** orchestrating five domain gods — designs and runs his life week by week:

- An *alive* chat experience (streaming, presence, gods stepping forward)
- **The Loom — the authoritative schedule lives IN the app.** Google Calendar and Gmail are **read-only data sources** (existing commitments, busy times, promises hiding in email), pulled through our own **MCP server** (course: MCP + security)
- Real **Telegram**: morning brief, evening check-in, chat relay (course: autonomous agents)
- The **Weekly Council**: parallel god subagents + synthesis + data + tips + user feedback (course: multi-agent collaboration)
- **The Observatory**: analytics as a night sky
- A visible **skill system** — eight named runtime skills power every flow (course: agentic workflows)

**The soul requirement:** talking to Maxwell must feel ALIVE. If any trade-off pits features against alive, choose alive.

**Demo narrative:** *"The harness patterns from Workshop 1 power this loop. Eight Workshop-2 skills load themselves at runtime. The Workshop-3 approval gate guards every schedule write, and the outside world enters read-only through an MCP server I authored. This week, it became a living product I use every day."*

---

## 1. The Demo Path (7 beats, ~3 minutes — drives all priorities)

1. **Olympus** loads: dark marble, breathing gold orb, "Good evening, Ohad." (silent awe)
2. **The Council**: "How does my week look?" — Maxwell streams instantly; mid-answer **Athena steps forward** (accent ring, nameplate, chime). (alive)
3. "Move tomorrow's gym block" → **The Loom** shows a proposal **diff** → approve → the schedule updates, laid over the real Google events it planned around. (real power)
4. **Phone buzzes on camera**: Telegram evening check-in with Done/Moved/Skipped buttons; a tap updates the app live. (autonomy)
5. **Weekly Council**: five god cards work **in parallel** (live statuses) → Zeus synthesizes data + tips → asks the user for feedback → next week proposed as one diff → sealed with if-then commitments. (multi-agent)
6. **Cmd+.** → **Behind the Veil**: live harness event stream — every tool call, risk tier, permission gate, MCP-vs-native badge, active skill, subagent lifecycle. (the course rubric, on screen)
7. **The Observatory**: the week as a starfield, life-wheel radar, candor streak. (poetry)

Bonus beat if asked "how did it learn you?": show onboarding's email scan — *"Maxwell read my recent inbox and found three commitments I'd forgotten."*

---

## 2. Scope

**P0:** monorepo + Mongo (Atlas) · harness (loop/registry/gate/events/streaming) · **skill system with the eight skills (§7)** · Council chat alive (<1.5s first token) · signup = "Know Thyself" first meeting (psychologist-led, email+telegram bindings, bridge-week plan) · schedule pipeline (intents → placer → diff → approval → in-app Loom) · Google Calendar + Gmail **read-only** via our MCP server · Telegram (link, brief, check-in, relay) · Weekly Council (data + tips + user feedback) · the Scroll (memory + consolidation) · Behind the Veil · Observatory v1 · seed script.
**P1:** LLM-composed morning brief · daily email scan (beyond onboarding) · Labors screen · Kleos + Mortal→Hero→Demigod→Olympian rank · per-god chimes · calendar re-sync (refresh imported events every 15 min).
**P2:** Oracle score · voice line at council seal · access-token gate for remote deploy · light mode.
**CUT:** payments, multi-user/auth system, WhatsApp, wearables, writing to Google Calendar or sending email, mobile apps, i18n, marketing pages, Google OAuth verification (Testing mode + owner as test user is correct — it also legitimately allows the gmail.readonly scope for a personal app).

---

## 3. Architecture & stack (final)

```
apps/web   React 18 + Vite + Tailwind v4 + framer-motion   (the six screens + signup flow)
   │  SSE + JSON/HTTP
apps/api   NestJS (run under tsx — don't fight build tooling)
   ├── ChatModule       POST /chat → SSE of HarnessEvents (imports runAgentLoop — never forks it)
   ├── CouncilModule    POST /council/start → multi-agent session (SSE)
   ├── ProposalsModule  approvals → apply to the in-app schedule (Mongo blocks)
   ├── AuthModule       GET /auth/google (+callback) → refresh token (scopes: calendar.readonly + gmail.readonly). Single user — NO login system
   ├── TelegramModule   grammY long-polling service (starts on bootstrap; no tunnels/webhooks)
   ├── RhythmModule     @nestjs/schedule crons: 07:05 brief · 21:30 check-in · 02:00 consolidation · */15 import re-sync (P1)
   └── VeilModule       GET /veil/stream → SSE of harness events
src/       Shared core (imported by api and scripts)
   ├── loop.ts          runAgentLoop — THE one agent loop
   ├── openai.ts        gpt-4o client · completeWithTools + streaming variant · serializeAssistantMessage
   ├── events.ts        HarnessEvent types + per-run event bus
   ├── config.ts        zod-validated env (ONLY place process.env is read)
   ├── log.ts           structured JSON HarnessLog → file sink (never stdout in product surfaces)
   ├── types.ts         ToolDefinition, errors, RunRecord, ApproveFn
   ├── pantheon.ts      god config (§4)
   ├── scheduling/      placer.ts + differ.ts (pure, unit-tested)
   ├── db/              mongoose connection + models (§5)
   ├── tools/           registry.ts + one file per tool (§6) + mcp-client.ts
   ├── skills/          loader.ts — 3-level runtime loading (port from sibling repo)
   └── workflows/       guardrails.ts (requiresApproval + approve hook) · first-meeting.ts + verify-first-meeting.ts
mcp/world-server.ts     our own READ-ONLY MCP stdio server: Google Calendar + Gmail (§8)
skills/                 the eight product skills (§7) — SKILL.md + scripts/ each
prompts/maxwell.system.md   runtime persona (edit the markdown, never inline in code)
scripts/repl.ts         dev REPL for testing the loop before UI exists (logs → file, clean stdout)
```

| Decision | Choice |
|---|---|
| Runtime LLM | **OpenAI gpt-4o** (Chat Completions + tools; `MAXWELL_MODEL` env). No provider migration this sprint |
| Monorepo | npm workspaces `["apps/*"]`; apps import `src/` via relative ESM imports (`.js` extensions), tsx runtime |
| DB | **MongoDB Atlas free tier (M0)** — no Docker, no local infra; `MONGODB_URI` = Atlas SRV string. (Supabase would mean switching back to Postgres — rejected to keep the fellowship Mongo stack) |
| Schedule of record | **The app (Mongo `blocks`)** — Google Calendar is never written, only read |
| Language | TypeScript strict everywhere; zod at every boundary; no `any` |
| Fonts | @fontsource: Cinzel · Cormorant SC · Spectral |
| Charts | Custom SVG (starfield, radar) — no chart library |
| Tests | vitest: placer, differ, jobs-ledger idempotency. Everything else: typecheck + Demo Path |

**Laws (from the owner's workshop contract — they bind here too):** one loop · one registry · one config path · model proposes, harness executes · persona in markdown · no LangChain/CrewAI orchestrator · no secrets in tracked files · users never see JSON logs · `npm run typecheck` before any task is "done" · ask Ohad before git commits.

---

## 4. The Pantheon (`src/pantheon.ts`)

The pantheon is the product's **single identity system**: each god's hue paints (a) that domain's **blocks in the Loom**, (b) chat persona styling when the god steps forward, (c) its radar axis, (d) its stars in the Observatory, (e) its flame on Olympus. One god = one hue EVERYWHERE; rank/metal (P1) is a separate visual channel.

| id | God | Domain | Accent | Dim | Symbol | Voice in one line |
|---|---|---|---|---|---|---|
| `zeus` | Maxwell | Orchestrator — the only default voice | `#F2D680` | `#4A5568` | lightning | Warm, sovereign, concise; dry wit; never sycophantic |
| `athena` | Athena | Career | `#7C8CA6` | `#3E4756` | owl | Strategic, precise, mentor-to-a-hero; asks the sharp question |
| `asclepius` | Asclepius | Health | `#4F8C82` | `#2E4B46` | serpent staff | Calm clinician-coach; protective of sleep |
| `hermes` | Hermes | Tasks & admin | `#34A8A0` | `#1F5B57` | winged sandal | Quick, playful; hates open loops |
| `hestia` | Hestia | Family & friends | `#E2823C` | `#7A4620` | hearth flame | Warm, unhurried; remembers names and dates |
| `apollo` | Apollo | Self-improvement | `#E8A33D` | `#7E5A23` | laurel | Luminous, aspirational; Delphic maxims sparingly |

Imported Google events render as **"the outer world"**: neutral stone-grey blocks (`#3A3542` border, muted text), visually beneath Maxwell's god-colored blocks — the product story is *your obligations vs. your designed life*.

Persona rules (`prompts/maxwell.system.md`): Maxwell is the single voice in normal chat; `[god:athena]` markers open domain passages (harness strips → `god` events → UI restyle). Gods NEVER shame ("the flame is banked, not extinguished"); tone dialable via Scroll. Gods become **real parallel subagents only in the Weekly Council**. Honest capability boundaries ("Capabilities today" vs "Coming online"); never claim an action a tool didn't confirm. Mythic flavor = seasoning, one flourish max per message.

---

## 5. Data model (mongoose, `src/db/models/`)

All documents carry `userId` (constant `"ohad"` — never assume singleton in code) + timestamps.

- `Scroll` — `profile` (object, §10), `version`. Patch-updated only
- `Memory` — durable user facts: `text`, `area` (life-area tag), `source` ('interview'|'chat'|'email')
- `Episode` — `kind` ('chat'|'council'|'first_meeting'|'checkin'), `summary`, `tags[]`, `consolidated`
- `Goal` — `godId`, `title`, `target`, `status`, `wheelBaseline` (1–10)
- `Block` — the designed schedule: `godId`, `title`, `start`, `end`, `status` ('proposed'|'scheduled'|'done'|'moved'|'skipped'|'cancelled'), `isAnchor`, `ifThen`, `cycleId`
- `ImportedEvent` — read-only mirror of Google events: `gcalId`, `title`, `start`, `end`, `lastSyncedAt`
- `Cycle` — a council-to-council week: `startsOn`, `endsOn`, `councilAt`, `kind` ('bridge'|'full'), `executionScore?`
- `Checkin` — `blockId`, `response` ('done'|'moved'|'skipped'), `via` ('telegram'|'web'), `note`
- `Proposal` — `kind` ('week_plan'|'edit'), `diff` ({adds,moves,deletes}), `status` ('pending'|'approved'|'rejected'|'applied'), `sessionId`
- `AgentAction` — audit ledger: `tool`, `input`, `risk`, `decision` ('allowed'|'gated'|'denied'), `result`, `runId`, `skill?`
- `ChatSession` + `Message` — `role`, `godId?`, `content`, `events?` (Veil replay)
- `TelegramLink` — `chatId?`, `linkToken` (unique), `linkedAt`
- `Job` — idempotency ledger: `key` unique (`brief:ohad:2026-07-08`), `status`, `payload`
- `GoogleToken` — refresh token + granted scopes
- `EmailInsight` — extracted commitments: `sourceMsgId`, `summary`, `when?`, `godId?`, `handled`
- `Kleos` (P1) · `Labor` (P1)

---

## 6. Harness, registry, gate (course exhibits #1–2)

Hand-rolled loop over **`openai`** Chat Completions — port the proven core from the sibling repo or write fresh to this contract (~300 lines, typed, zero magic):

```
runAgentLoop({ runId, system, messages, tools, maxTurns=8, approve?, onEvent?, ctx })
  → { messages, output, record }

turn loop:
  if turn >= maxTurns → MaxTurnsExceededError
  response = completeWithTools[Streaming](model, messages, toOpenAITools(tools))
  append serializeAssistantMessage(response)          // NEVER raw SDK objects in history
  if no tool_calls → return output
  for each tool_call:
    emit tool_start {name, risk, source, skill?}
    if requiresApproval(tool, policy) and !approved   // guardrail gate
       → emit tool_gate {decision:'gated'} → tool result = "BLOCKED: awaiting user approval"
    else → result = dispatchTool(name, args, ctx)     // zod-validate args first
    emit tool_result · write AgentAction audit row
    append { role:'tool', tool_call_id, content }
```

- **Streaming:** with `onEvent`, emit `token` per text delta while accumulating tool_call chunks. First token < 1.5s: no blocking pre-work (context pre-fetched by the API layer); memory/episode writes AFTER `done`, fire-and-forget.
- **Events** (`src/events.ts`): `token` · `god` · `status` (per-tool copy map: "Reading the Loom…", "Consulting the outer world…") · `skill {name, level}` (fires on skill load — judges see the skill system working) · `tool_start` · `tool_gate` · `tool_result` · `subagent {godId, state}` · `proposal {id}` · `usage` · `done` · `error`. Per-run typed bus; VeilModule bridges to SSE; HarnessLog mirrors to file.
- **Structured outputs** (WeekIntents, GodReport, ScrollPatch, EmailInsights): dedicated non-streaming call, single forced tool, `strict: true`. **OpenAI strict-mode law: every property in `required`; optionals are nullable** (`type: ["string","null"]`, zod `.nullish()`). One retry with the validation error appended.
- **ToolRegistry** (`src/tools/registry.ts`): `ToolDefinition {name snake_case, description, risk: 'read_only'|'write'|'destructive', source: 'native'|'mcp', scope: GodId[]|'all', parameters, execute}` — one file per tool, ONE registry, `forAgent(godId)` scope filter, `getToolRisk` for the gate.

| Tool | Risk | Source | Behavior |
|---|---|---|---|
| `get_week` | read_only | native | Blocks+imported events+checkins+goals for a range, stats pre-aggregated in code — **no LLM arithmetic, ever** |
| `get_scroll` / `update_scroll` | read_only / write | native | Profile read · validated merge-patch, version++ |
| `remember` / `recall` | write / read_only | native | Durable user facts with life-area tags |
| `propose_week` / `propose_edit` | write | native | `WeekIntents` (§9.3 — NO datetimes) → placer → differ → Proposal doc → `proposal` event. Auto-allowed (creates only a proposal) |
| `apply_proposal` | **destructive** | native | Writes the approved diff to `blocks`. ALWAYS gated — model-initiated calls are blocked; the human Approve button hits the endpoint that executes it |
| `world_calendar_events` / `world_freebusy` / `world_email_scan` | read_only | **mcp** | From our MCP world-server (§8) |
| `add_labor` / `complete_labor` / `award_kleos` | write | native | P1 |

**Approval policy (deterministic code, never prompts):** `requiresApproval` defaults to `['destructive']`. The schedule of record can therefore never change from model initiative — only through the human-approved proposal path. **Injection defense:** calendar titles, email content, and Telegram text are untrusted — wrapped as `<untrusted>` data in prompts; nothing writes the Scroll from those paths except through validated tools.

## 7. The Skill System (course exhibit #3 — eight named skills, `skills/`)

Port the sibling repo's 3-level loader (`src/skills/loader.ts`): level 1 = always-on catalog in the system prompt · level 2 = `load_skill` pulls the full SKILL.md on trigger · level 3 = scripts/resources on demand. Every load emits a `skill` event → the Veil shows which skill is thinking. Each skill = `SKILL.md` (playbook the model follows) + `scripts/` (deterministic product code).

| Skill | Used by | Playbook (SKILL.md) | Deterministic scripts |
|---|---|---|---|
| `psychologist` | First Meeting | The interview: warm, one question at a time, cover all life areas (career, health, tasks, people, self, energy, constraints), probe the *why* behind goals, never interrogate | coverage-tracker (which areas have facts) |
| `week-planner` | Council, First Meeting | Intent design rules: ≤60% of free time, never every evening, anchors first, respect energy map, bridge-week logic | `placer.ts` + `differ.ts` (the actual placement) |
| `editor` | Chat | Mid-week changes: smallest diff that honors the goal; always propose, never apply | diff builder |
| `observer` | Council prep, Observatory | Reading a week honestly: adherence per god × time-slot, streaks, drift patterns; data before judgment | stats aggregators (`get_week` internals) |
| `verifier` | First Meeting, proposals | Trust nothing the agent claims — check the stores | `verify-first-meeting.ts` (identity + ≥3 areas + wheel + ≥1 goal + bindings + council slot) · proposal sanity checks (no overlaps, real dates) |
| `notifier` | Rhythm | Brief/check-in composition: ≤600 chars, one focus, god emoji, quiet hours, never shame | Telegram senders + Job-ledger wrap |
| `feedbacker` | Council close | End-of-week ritual: wins first → data → tips (one per god max) → ask the user 2–3 questions incl. "What did I get wrong about you this week?" → capture answers to Scroll | episode writer |
| `visualizer` | Observatory | Chart-worthiness rules: what earns a star's brightness, radar semantics, candor framing | dataset builders for starfield/radar/bars |

This is the Workshop-2 story at product scale: **skills used at dev time AND runtime**, playbooks in markdown, determinism in scripts, visible in the Veil.

## 8. The World Server — read-only MCP (`mcp/world-server.ts`)

Our own MCP stdio server (`@modelcontextprotocol/sdk`) wrapping googleapis, booted by the API as a child process; `src/tools/mcp-client.ts` adapts its tools into the ONE registry with `source:'mcp'`.

- `world_calendar_events {from, to}` — events from Google Calendar → upserts `ImportedEvent` mirror, returns normalized list
- `world_freebusy {from, to}` — busy ranges (imported events + Maxwell blocks merged by the caller)
- `world_email_scan {sinceDays, max}` — recent Gmail (metadata + snippets, max ~50): returns raw snippets which the CALLER then structures via a forced `EmailInsights` extraction call → `EmailInsight` docs (commitments, deadlines, invitations, each with a suggested god + date)

**Security story (demo line):** *"The outside world enters Maxwell read-only, through an MCP server I authored — scopes are calendar.readonly and gmail.readonly, the server exposes zero write tools, every crossing is logged, and everything it returns is treated as untrusted input. The only thing that can change the schedule is a human tapping Approve."*
Google auth (single user): one consent — `calendar.readonly` + `gmail.readonly`, `access_type=offline`, `prompt=consent` → refresh token stored. Cloud setup: Testing mode + owner as test user (legitimately allows Gmail scope for a personal app, ≤100 test users, no CASA/verification).

## 9. Flows

### 9.1 Council chat
`POST /chat` → pre-fetched context (Scroll + week stats) → `runAgentLoop` streaming → SSE. maxTurns 8. `editor` skill loads on schedule-change requests.

### 9.2 The First Meeting — "Know Thyself" (THE signup — nothing else exists until it's done)
First visit ever → full-screen ritual (no nav, no app shell). The `psychologist` skill leads. **This is the product's most important 25 minutes — polish over speed.**

- **I · The Meeting** — Maxwell introduces himself honestly, then interviews: one question at a time, covering all life aspects — career, health, tasks/admin, family & friends, self-improvement, energy patterns, constraints, what's slipping. Every durable fact → `remember` (with area). The coverage tracker shows quiet progress (constellation filling in).
- **II · The Wheel** — 5 sliders (1–10, god icons); radar draws live; saved as `Goal.wheelBaseline`.
- **III · The Awakening** — 1–3 goals; each named domain's god flips grayscale → accent + chime + one line in-voice. (THE moment.)
- **IV · The Bindings** — smooth, honest, one screen per bind:
  1. *Google*: "Let me see your calendar and inbox — I read, I never write." → one OAuth consent → immediately: `world_calendar_events` imports the visible week onto a mini-Loom ("this is your outer world") **and** `world_email_scan` runs → "I found N commitments in your email" → user confirms/dismisses each (confirmed → future blocks/labors). The wow: *Maxwell noticed the dentist appointment you never calendared.*
  2. *Telegram*: deep link `t.me/<bot>?start=<token>` → live "linked ✓" → Maxwell sends the first message to the phone on the spot.
- **V · The First Thread** — council slot chosen (default: Saturday evening) → **the Bridge**: `week-planner` designs signup-day → council-day only (a partial cycle, `Cycle.kind='bridge'`) around imported events + confirmed email commitments → Loom diff preview → approve → scheduled. *"We start small. Saturday evening, we design your first full week together."*
**Verifier** (`verify-first-meeting.ts`, deterministic, reads the stores): identity + facts in ≥3 life areas + wheel baselines + ≥1 goal + Google bound + Telegram bound + council slot + bridge plan applied. Fail → one corrective system message, continue the interview. Scroll v1 written; episode logged; redirect to Olympus, now alive with real data.

**Mid-week signup answer (encoded):** a Thursday signup gets a Thursday→Saturday bridge; the first full Sunday→Saturday cycle is designed at Saturday's council. All cycles are council-anchored (`Cycle`), not calendar-week-anchored.

### 9.3 Weekly Council (the multi-agent workflow — every council, the user GETS data + tips and GIVES feedback)
1. **Prepare (code):** cycle data + per-god stats (`observer` scripts).
2. **Fan-out:** `Promise.all` over 5 gods — each `runAgentLoop` (maxTurns 3, read-only tools scoped to domain, god persona) forced to strict `GodReport {godId, headline, wins[], concerns[], tip, proposedIntents[], oneQuestion}`. UI: five god cards, live `subagent` events; a failed god shows "silent this week" — never abort.
3. **Synthesis (streaming, `feedbacker` skill):** wins first → **the data** (planned-vs-actual, execution score — numbers from code) → **the tips** (max one per god) → **the feedback exchange**: 2–3 questions to the user incl. "What did I get wrong about you this week?" — answers → Scroll.
4. **Design next cycle:** merged `WeekIntents` → pipeline → ONE approval for the whole week (`Cycle.kind='full'`).
5. **Seal:** every kept priority gets an if-then (`Block.ifThen`) · Kleos (P1) · episode written · consolidation queued.

### 9.4 Schedule pipeline (LLM proposes intents, CODE places blocks — never the reverse)
`WeekIntents = { intents: [{godId, title, durationMin, frequencyPerWeek, priority 1-5, timePreferences: ('early_morning'|'morning'|'lunch'|'afternoon'|'evening')[], daysAllowed?, isAnchor, rationale}], drops?: blockId[] }`
→ `placer.ts` (pure): busy grid = ImportedEvents + existing blocks → priority-ordered greedy fit honoring Scroll constraints + 15-min buffers → placements + `unplaced[]` (returned to the model → conversational trade-off, never silent drop)
→ `differ.ts` (pure): `{adds, moves, deletes}` → Proposal → diff card → human approval → `apply_proposal` endpoint writes blocks. Model-initiated `apply_proposal` = gated (the Veil shows the block — a demo beat).

### 9.5 Autonomous rhythm (RhythmModule; every send wrapped in the `Job` ledger: claim key → run → mark)
- **07:05 Morning brief** (`notifier`) — today's blocks + outer-world events + one focus (P0 template; P1 gpt-4o-composed ≤600 chars) → Telegram.
- **21:30 Evening check-in** — one message; per block a row of `✅ ↷ ✕` buttons (`chk:<blockId>:<answer>`) → Checkin + Block.status + **candor streak++ for ANY honest answer including skipped** → edit message in place.
- **02:00 Consolidation** — unconsolidated Episodes → forced `ScrollPatch` (merge-patch + `learnedThisWeek[]`) → apply, version++ → UI card "Maxwell learned N things about you."
- ***/15 Import re-sync (P1)** — refresh `ImportedEvent` mirror; new outer-world conflicts flagged to the user ("your Thursday filled up — want me to move the writing block?").
- **Chat relay** — plain Telegram text → same `runAgentLoop` → reply. Dedup by `update_id` (Telegram has ZERO idempotency — the Job ledger is the only double-send protection). Answer callbacks < 2s.
- Linking: `linkToken` = crypto.randomBytes(16) base64url, 15-min expiry, single-use atomic bind.

## 10. The Scroll (memory)

`Scroll.profile`: `identity {name, timezone}` · `preferences {tone: gentle|balanced|blunt, quietHours}` · `goals[]` · `constraints[]` ("no work after 21:00") · `energyMap {chronotype, bestFocus[]}` · `people[]` · `followThrough {[godId]: {scheduled, done}}` — **computed by code from Checkins, never LLM-written** · `learned[] {week, insight, sourceEpisodeId}`.
Patch-only updates (validated merge-patch, version bump). Small → included in every agent's system prompt — this is what makes Maxwell *know you* by Day 2. The Forge renders it read-write: user-visible memory = the trust story.

## 11. Screens & the ALIVE spec (apps/web)

Tokens: surfaces `#0B0A10 / #15141B / #1E1C26 / #28252F` · hairline `#3A3542` · text `#EDE6D6 / #B9B2A2 / #726C64` · gold `#C6A15B` (hover `#E8C87E`, pressed `#8C6A3F`) — **never `#FFD700`** · god accents §4 · outer-world grey. Cinzel = display/god names/numerals (uppercase, wide tracking) · Cormorant SC = labels · Spectral = body (16px+, 1.6 leading). Dark only. 3–4% film-grain on large gradients. **Color-as-event:** neutral field; god hues/gold ignite only at moments.

Aliveness ACs: (1) first token < 1.5s · (2) tokens fade in per chunk (80ms) · (3) god step-forward 300ms: avatar 1.06, accent ring draw, nameplate, chime · (4) shimmer status line during tool calls · (5) Olympus orb 6s breathing over slow parallax starfield · (6) mythic empty state on every screen · (7) hover = 150ms gold-foil sheen; no bounces — motion is liturgy, not confetti · (8) **Behind the Veil** (Cmd+.): right drawer, monospace, live events with risk badges, gate decisions, native/MCP badges, **active-skill chips**, subagent states, token usage — must work during the council fan-out.

Routes: `/onboarding` **The First Meeting** (§9.2 — the signup; no Scroll → forced here) · `/` **Olympus** (greeting, orb, today-strip of god-colored gems over outer-world grey, god-flames row = 7-day adherence) · `/council` **The Council** (chat; 5 god cards banner during weekly session) · `/loom` **The Loom** (custom 7-col week grid; **two layers: outer-world grey beneath, god-colored Maxwell blocks above**; proposal mode: adds gold-dashed glow, moves ghost→arrow, deletes fade-to-ash; Approve/Reject bar; planned-vs-actual toggle) · `/labors` (P1) · `/observatory` (Week of Stars sized by execution % · life-wheel radar baseline-vs-now · per-god execution bars · candor flame) · `/forge` (bindings status: Google/Telegram/MCP · Scroll editor · tone dials · quiet hours · sound toggle · reseed).

## 12. Three-day plan (each day ends demoable)

**Day 1 — Foundations & the Alive Council.** Monorepo scaffold (workspaces, Nest + Vite, Tailwind, fonts) → Atlas connection + models → config/log/types → harness: loop + registry + gate + events + streaming (port sibling core, extend) → **skills loader + catalog (port)** → pantheon.ts → tools `get_week`/`get_scroll`/`remember`/`recall` → ChatModule SSE + Council UI (streaming, god step-forward, shimmer) → VeilModule + overlay (incl. skill chips) → `scripts/repl.ts` → seed v1.
**AC:** typecheck green · web chat streams < 1.5s · `[god:x]` restyle visible · Veil shows tool calls with risk badges and a skill loading.

**Day 2 — The World & the First Meeting.** `mcp/world-server.ts` (3 read-only tools) + client adapter + registry mount (MCP badge) → Google OAuth (both readonly scopes) + import mirror → email scan + `EmailInsights` extraction → placer + differ (+ vitest) → Proposals + Loom two-layer UI + apply endpoint → `propose_week`/`propose_edit`/`apply_proposal` (gated) → **First Meeting Acts I–V** (`psychologist` + `week-planner` + `verifier` skills, bridge-cycle logic) → TelegramModule (link/relay/check-in/brief templates via `notifier`) + RhythmModule + Job ledger.
**AC:** fresh user completes the First Meeting → outer world imported + ≥1 email commitment surfaced → bridge plan applied to the Loom → phone gets check-in → ✅ tap updates web → "move my gym block" yields a diff that applies → Veil shows the gate blocking a model-initiated apply.

**Day 3 — The Council & the Sky.** Weekly Council end-to-end (fan-out cards, synthesis with data+tips+feedback exchange, next-cycle diff, if-then seals; `observer`+`feedbacker` skills) → consolidation + "Maxwell learned N things" → Observatory (`visualizer`) → Forge → P1 in order (composed brief · daily email scan · Labors · Kleos · re-sync · chimes) → polish sweep (empty states, motion, believable seed) → README (architecture diagram + concept map + judge section + setup + demo script) → **run the Demo Path twice; fix every stumble.**
**AC:** all 7 beats green back-to-back · fan-out visibly parallel in the Veil · typecheck/tests clean.

## 13. Why this wins (write this into the README — the judge's-eye view)

What a judge sees that cohort projects won't have:

1. **The architecture is on screen.** Behind the Veil shows the loop, risk tiers, permission gates, MCP boundary, active skills, and parallel subagents LIVE — most teams *tell* judges about their harness; this one *shows* it during the demo.
2. **Every workshop concept, load-bearing, in one product:** W1 hand-rolled harness (no framework) · W2 eight runtime skills with 3-level loading + deterministic verifier · W3 authored read-only MCP server + gated writes + untrusted-input wrapping + audit ledger · W4 cron-driven autonomy hitting a real phone · W5 true parallel multi-agent council with structured reports · W6 a real product its builder uses daily.
3. **Security by architecture, not by prompt:** the outside world (Calendar, Gmail) enters read-only through MCP; the only write path to the schedule is a human tap; the model literally cannot mutate state on its own initiative — and the demo shows the gate blocking it.
4. **The emotional layer is engineered, not decorated:** persona council with per-god identity systems, streaming presence, ritual design (First Meeting → daily rhythm → weekly council), honesty-rewarding candor streak — "addictive but ethical" as explicit design.
5. **It closes the loop:** interview → design → live on the phone → check-ins → data → feedback → the next week is measurably smarter (the Scroll's `learned[]` shown on screen).

## 14. Env (`.env.example` — placeholders only; real keys in gitignored `.env`)

```
OPENAI_API_KEY=
MAXWELL_MODEL=gpt-4o
MAXWELL_MAX_TURNS=8
MONGODB_URI=            # MongoDB Atlas M0 (free) SRV string
GOOGLE_CLIENT_ID=       # redirect: http://localhost:3001/auth/google/callback
GOOGLE_CLIENT_SECRET=
TELEGRAM_BOT_TOKEN=     # @BotFather /newbot
APP_URL=http://localhost:5173
API_URL=http://localhost:3001
TZ_DEFAULT=Asia/Jerusalem
```
Owner setup (~15 min, human): MongoDB Atlas free cluster (M0) + connection string · Google Cloud project → enable Calendar API + Gmail API → OAuth consent (External/Testing + own email as test user) → OAuth client with scopes calendar.readonly, gmail.readonly · BotFather token · OpenAI key.

## 15. Seed & definition of done

`npm run seed:demo` — 3 weeks of believable history (cycles, blocks across all gods at ~78% adherence with dips, checkins, imported events, email insights, episodes, candor streak 12, wheel baseline vs improved, one prior council). Deterministic RNG. `seed:wipe` resets. The Observatory must look inhabited on demo day.

**Done =** typecheck + vitest green · Demo Path passes twice consecutively · no secrets tracked · persona "Capabilities today" honest · README complete (what/why/architecture/concept map/§13 judge section/setup/demo script).
