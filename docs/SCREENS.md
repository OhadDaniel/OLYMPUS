# MAXWELL — Screens to design

What each screen is, what it does, the data behind it (real API), its states, and the
"alive" moments. Backend for all of these is built and returning real data — you're designing
the *look*; the wiring exists. Screens marked **NEW UI** have no front-end yet.

## Design system (so designs match the build)
- **Dark only.** Surfaces `#0B0A10 / #15141B / #1E1C26 / #28252F`, hairline `#3A3542`.
- **Text** `#EDE6D6` (primary) / `#B9B2A2` (secondary) / `#726C64` (muted).
- **Gold** `#C6A15B` (hover `#E8C87E`, pressed `#8C6A3F`) — never `#FFD700`. Color is an *event*: neutral field, hues ignite only at moments.
- **God hues (one per god, everywhere):** zeus `#F2D680`, athena `#7C8CA6`, asclepius `#4F8C82`, hermes `#34A8A0`, hestia `#E2823C`, apollo `#E8A33D`. Imported "outer-world" events = stone-grey `#3A3542`.
- **Fonts:** Cinzel (display / god names / numerals, uppercase, wide tracking) · Cormorant SC (labels) · Spectral (body, 16px+, 1.6 leading).
- **Motion is liturgy, not confetti:** token fade-in per chunk (~80ms), god step-forward 300ms (avatar 1.06 + accent ring draw + nameplate + chime), shimmer status line during tool calls, 6s breathing orb, 150ms gold-foil hover sheen. Honor `prefers-reduced-motion`.

---

## 0. App shell (persistent)
- **Role:** frame around every screen; how you move between the five places.
- **Contains:** wordmark "MAXWELL"; tabs **Council · The Loom · Observatory · Forge**; a `⌘.` affordance for the Veil.
- **States:** active tab highlighted in gold; everything else muted (color-as-event).

## 1. The First Meeting — `/onboarding`  (**the most important 25 minutes**)
- **Role:** first-ever visit; the "Know Thyself" ritual. Full-screen, **no app shell, no nav** — nothing else exists until it's done.
- **Five acts (hold the arc; never announce it):**
  1. **The Meeting** — Zeus introduces himself, asks the user's name, then interviews one question at a time. A **coverage constellation** fills in quietly as life areas gain facts (career, health, tasks, people, self, energy, constraints) — *don't* show a checklist/progress bar; show stars kindling.
  2. **The Wheel** — 5 sliders (1–10) with god icons; a **radar draws live** as they move. Saves each as a goal baseline.
  3. **The Awakening** — 1–3 goals named; each named domain's god flips **grayscale → its accent + a chime + one line in-voice.** This is the emotional peak — let it breathe.
  4. **The Bindings** — Zeus connects the outside world conversationally, one per screen: **Google** ("I read, I never write") → then it shows *"I found N commitments in your email"* as confirm/dismiss cards; **Telegram** → deep link, live "linked ✓", first message hits the phone.
  5. **The First Thread** — pick a council day (default Saturday eve) → the **bridge plan** appears as a Loom diff preview → approve → scheduled. *"Saturday, we design your first full week."*
- **Data/API:** chat SSE (`POST /chat` — becomes the interview when no Scroll) · `POST /onboarding/wheel` · `POST /onboarding/goals` · `GET /auth/google` · `POST /onboarding/scan-email` + `GET /onboarding/insights` · `POST /telegram/link` · `POST /onboarding/bridge` → `POST /proposals/:id/approve` · `GET /onboarding/verify` (gates completion) · `POST /onboarding/complete`.
- **States:** streaming interview; slider/radar live; god awakening animation; each binding = connecting / connected / error; email cards = pending/confirmed/dismissed; bridge = proposed/approved.

## 2. Olympus — `/` (home)
- **Role:** the awe-first landing. "Good evening, Ohad."
- **Contains:** breathing **gold orb** over a slow parallax **starfield**; the greeting (time-aware); a **today-strip** of god-colored gems for today's blocks laid over outer-world grey; a **god-flames row** = 7-day adherence per god (bright flame = kept, banked = slipped, never "extinguished").
- **Data/API:** `GET /loom/week` (today's blocks + outer world) · `GET /observatory` (per-god adherence for the flames).
- **States:** empty ("your day is open"); inhabited; a god flame dim vs bright.

## 3. The Council — `/council` (everyday chat)
- **Role:** the alive conversation with Maxwell. Where "move my gym block", "how's my week", planning happens.
- **Contains:** message stream (user right, Maxwell left); **god step-forward** — when a `[god:x]` passage streams, that segment gets the god's accent, a nameplate, a left-rule, a chime; a **shimmer status line** during tool calls ("Reading the Loom…", "Consulting the outer world…"); composer.
- **Data/API:** `POST /chat` SSE — frames: `token` (fade in per chunk), `god`, `status`, `tool_start/result`, `proposal`, `done`.
- **States:** empty ("the council is listening"); streaming; a proposal produced → a card linking to the Loom.

## 4. The Weekly Council — session view  (**NEW UI** — backend + SSE done, no front-end yet)
- **Role:** the weekly multi-agent ritual (demo beat 5). Five gods deliberate in parallel, then Zeus synthesizes and proposes next week.
- **Contains:** **five god cards** that light up with live status (spawned → working → done, or "silent this week"); when they finish, each card shows headline / wins / concerns / tip / its one question; then Zeus's **synthesis streams** below (wins → the data/numbers → one tip per god → 2–3 feedback questions incl. "what did I get wrong about you this week?"); ends with **next week as one Loom diff** to approve; kept priorities sealed with if-then lines.
- **Data/API:** `POST /council/start` SSE — frames: `subagent {godId,state}` (drive the cards), `reports` (the 5 GodReports), `token` (synthesis), `proposal {id}`, `done`.
- **States:** convening; cards working (parallel); a god silent; synthesis streaming; feedback capture; proposal pending.

## 5. The Loom — `/loom` (the schedule of record)
- **Role:** the designed week. Two layers: **outer-world grey beneath, god-colored blocks above** — "your obligations vs. your designed life."
- **Contains:** custom **7-column week grid** with time rows; blocks positioned by time, colored by god, anchor markers; **proposal mode** overlay — adds = gold-dashed glow, moves = ghost→arrow, deletes = fade-to-ash — with an **Approve / Reject** bar; a planned-vs-actual toggle (done/moved/skipped shading).
- **Data/API:** `GET /loom/week` · `GET /proposals?status=pending` + `GET /proposals/:id` (the diff) · `POST /proposals/:id/approve|reject`.
- **States:** empty week; inhabited; proposal pending (diff overlay + bar); post-approve refresh.

## 6. The Observatory — `/observatory`
- **Role:** the week as poetry — honest data, framed as courage.
- **Contains:** **Week of Stars** (each day a star sized/brightened by execution %); **life-wheel radar** (baseline dashed vs now, per god axis); **per-god execution bars**; **candor flame** (streak number + honest-answer count).
- **Data/API:** `GET /observatory` → `{ radar[], bars[], stars[], candor{streak,totalAnswers} }`.
- **States:** sparse (early) vs inhabited; a bright week vs a dim one — never shaming.

## 7. The Forge — `/forge` (trust + control)
- **Role:** where the user sees and steers what Maxwell knows and is connected to. The trust story.
- **Contains:** **bindings status** (Google / Telegram / MCP — connected or Connect action); the **Scroll**, read-write (identity, tone dial gentle/balanced/blunt, quiet hours, constraints, energy map, follow-through per god); **"Maxwell learned N things about you"** list; sound toggle; reseed (dev).
- **Data/API:** `GET /forge/status` → `{ bindings, scroll, version }` · `GET /auth/google` · `POST /telegram/link`.
- **States:** each binding on/off; Scroll fields editable; learned list.

## 8. Behind the Veil — overlay (⌘.)
- **Role:** the course rubric, on screen. Proves the architecture live.
- **Contains:** right drawer, **monospace**; live harness events with **risk badges** (read_only/write/destructive), **gate decisions** (⛔ gated), **native vs MCP** badges, **active-skill chips**, **subagent states**, token usage. Must keep flowing during the council fan-out.
- **Data/API:** `GET /veil/stream` SSE (every run's events, tagged by runId).
- **States:** quiet ("the harness is quiet") vs streaming.

---

### Priority for design
1. **First Meeting** (§1) — the make-or-break 25 min.
2. **Council chat** (§3) + **Weekly Council cards** (§4, needs new UI) — the alive/multi-agent story.
3. **Loom** (§5) — the real-power beat.
4. **Olympus** (§2), **Observatory** (§6), **Forge** (§7), **Veil** (§8).
