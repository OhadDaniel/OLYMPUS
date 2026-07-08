# Backend image for Railway / Fly.io / Render-Docker. Persistent Node process:
# NestJS API + the read-only MCP world-server (spawned as a tsx subprocess) +
# Telegram polling + crons. Secrets come from the host env at runtime, never baked in.
FROM node:22-slim

WORKDIR /app
COPY . .
RUN npm install

ENV NODE_ENV=production
ENV MAXWELL_LOG=stdout
# Hosts inject $PORT; the app reads it. 3011 is only the local default.
EXPOSE 3011

CMD ["npm", "run", "start"]
