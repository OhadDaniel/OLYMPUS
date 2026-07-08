# Deploying MAXWELL fully live

**Front end** → already on Vercel: https://maxwell-app-nu.vercel.app
**Back end** → a *persistent* Node host (Render / Railway / Fly). It can't be Vercel
serverless: it runs Telegram long-polling, a spawned MCP subprocess, cron jobs, and SSE.

The repo is prepped: `main.ts` binds `$PORT` on `0.0.0.0`, CORS allows the Vercel origin,
`tsx` is a runtime dependency (the MCP subprocess needs it), and `npm run start` boots the API.

## Recommended: Render (via the blueprint in `render.yaml`)

1. **Render → New + → Blueprint**, pick the `OhadDaniel/OLYMPUS` repo. It reads `render.yaml`
   and creates the `maxwell-api` service (build `npm install`, start `npm run start`).
2. **Set the secret env vars** (dashboard → Environment). Copy the values from your local `.env`:
   - `OPENAI_API_KEY`
   - `MONGODB_URI`  (your Atlas URI)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `TELEGRAM_BOT_TOKEN`
   - `API_URL` → this service's own URL, e.g. `https://maxwell-api.onrender.com`
   (`APP_URL`, `TZ_DEFAULT`, `MAXWELL_LOG`, `NODE_ENV` are prefilled by the blueprint.)
3. **Google Cloud Console** → your OAuth client → **Authorized redirect URIs** → add
   `https://maxwell-api.onrender.com/auth/google/callback` (keep the localhost one for dev).
4. **MongoDB Atlas** → Network Access → allow the host (`0.0.0.0/0`, or Render's egress IPs).
5. **Deploy.** When it's live, tell me the URL — I set Vercel's `VITE_API_URL` to it and redeploy
   the front end, so the live site talks to the live backend.

### Notes
- **Free tier sleeps** after ~15 min idle → the autonomous morning/evening rhythm and weekend
  nudge won't fire on time, and the first request after idle is a ~30s cold start. For a real
  always-on daily tool + reliable crons, use the **Starter** plan (change `plan:` in `render.yaml`).
- **One Telegram poller at a time.** While the hosted backend is polling, don't also run a local
  `npm run dev:api` with the *same* bot token — Telegram returns 409 (two getUpdates). Use a
  second BotFather bot for local dev if you need both.

## Alternative: Railway / Fly (Docker)
`Dockerfile` + `.dockerignore` are included. `railway up` or `fly launch` (both need their CLI +
a browser login), set the same env vars, then give me the URL for the Vercel wiring.
