# CLAUDE.md — maxwell-app

Fresh capstone build. **`SPEC.md` is the single source of truth — read it fully before any code, then execute it day by day (Day 1 → 2 → 3), in order.** The 7-beat Demo Path in SPEC §1 is sacred: when in doubt, choose whatever keeps it green, and choose ALIVE over more features.

## Working agreement

- **Plan → build → verify per SPEC section.** After each feature: `npm run typecheck` (must pass) + a real manual smoke of the affected flow. Never claim done without running it.
- **Never fake the real integrations silently.** If blocked on a credential (OpenAI, Google, Telegram, Mongo), stop and ask Ohad — do not stub and move on without saying so.
- **Ask Ohad before any git commit.** Never commit `.env` or `data/`/`logs/`.
- **Reference repo:** `/Users/ohaddaniel/maxwell` (the owner's Workshop 1–2 harness). You may read it and port its harness core (loop/registry/guardrails/log patterns) as the Day-1 seed. **Never modify that repo.**
- When building charts (Observatory), load the `dataviz` skill first if available.

## Hard rules (from the owner's workshop contract — they bind here too)

- **One agent loop** (`src/loop.ts`), one tool registry, one config path. Import — never fork or duplicate.
- **Model proposes, harness executes:** every side effect goes through `dispatchTool` with zod validation; calendar mutations only via the human-approved proposal path.
- **Persona lives in `prompts/maxwell.system.md`** — edit the markdown, never inline prompts in code. Keep "Capabilities today" honest; never claim unshipped tools.
- **No LangChain/CrewAI orchestrator.** First-principles harness only.
- **Users never see JSON harness logs** — logs go to file (`logs/`), stdout stays clean.
- OpenAI strict tools: **every property in `required`; optionals are nullable** (`type: ["string","null"]`, zod `.nullish()`).
- ESM + strict TS: `.js` extensions on relative imports, no `any`, zod at boundaries, env only via `src/config.ts`.

## Commands (establish these in Day 1 scaffold)

```
docker compose up -d          # mongo
npm run dev:api               # NestJS via tsx (port 3001)
npm run dev:web               # Vite (port 5173)
npm run repl                  # dev REPL against the loop
npm run typecheck             # must pass before "done"
npm run test                  # vitest (placer, differ, job ledger)
npm run seed:demo | seed:wipe
```

## Context

Owner: Ohad Daniel — MasterSchool agentics fellow; this is his Workshop 6 capstone (demo day in ~3 days) and his real daily tool. Single user, no login system. Product: MAXWELL — a Greek-pantheon council of agents (Maxwell/Zeus + Athena, Asclepius, Hermes, Hestia, Apollo). The schedule of record lives IN the app (the Loom); Google Calendar + Gmail are READ-ONLY sources entering through our own MCP server; rhythm runs over real Telegram; a weekly multi-agent council designs each cycle; eight runtime skills power the flows; the Scroll learns him week over week. Full detail: SPEC.md.
