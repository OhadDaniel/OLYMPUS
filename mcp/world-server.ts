import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google } from "googleapis";
import { z } from "zod";
import { USER_ID } from "../src/config.js";
import { connectDb } from "../src/db/index.js";
import { getAuthedClient } from "../src/google/oauth.js";

/**
 * Maxwell's OWN read-only MCP server — the ONLY doorway the outside world
 * (Google Calendar + Gmail) enters through. It exposes ZERO write tools. stdout
 * is the MCP protocol channel and MUST stay clean (no console.log here).
 */
function textResult(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj) }] };
}

async function main(): Promise<void> {
  await connectDb();
  const server = new McpServer({ name: "maxwell-world", version: "1.0.0" });

  server.registerTool(
    "world_calendar_events",
    {
      description: "Read Google Calendar events in a time range (READ-ONLY). Returns normalized events.",
      inputSchema: { from: z.string(), to: z.string() },
    },
    async ({ from, to }) => {
      const auth = await getAuthedClient(USER_ID);
      const cal = google.calendar({ version: "v3", auth });
      const res = await cal.events.list({
        calendarId: "primary",
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(to).toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 100,
      });
      const events = (res.data.items ?? [])
        .map((e) => ({
          gcalId: e.id ?? "",
          title: e.summary ?? "(busy)",
          start: e.start?.dateTime ?? e.start?.date ?? null,
          end: e.end?.dateTime ?? e.end?.date ?? null,
        }))
        .filter((e) => e.gcalId && e.start && e.end);
      return textResult({ ok: true, events });
    },
  );

  server.registerTool(
    "world_freebusy",
    {
      description: "Read busy time ranges from Google Calendar (READ-ONLY).",
      inputSchema: { from: z.string(), to: z.string() },
    },
    async ({ from, to }) => {
      const auth = await getAuthedClient(USER_ID);
      const cal = google.calendar({ version: "v3", auth });
      const res = await cal.freebusy.query({
        requestBody: {
          timeMin: new Date(from).toISOString(),
          timeMax: new Date(to).toISOString(),
          items: [{ id: "primary" }],
        },
      });
      const busy = res.data.calendars?.primary?.busy ?? [];
      return textResult({ ok: true, busy });
    },
  );

  server.registerTool(
    "world_email_scan",
    {
      description:
        "Read recent Gmail message metadata + snippets (READ-ONLY). Returns raw snippets; the caller extracts structured commitments.",
      inputSchema: { sinceDays: z.number(), max: z.number() },
    },
    async ({ sinceDays, max }) => {
      const auth = await getAuthedClient(USER_ID);
      const gmail = google.gmail({ version: "v1", auth });
      const q = `newer_than:${Math.max(1, Math.floor(sinceDays))}d`;
      const list = await gmail.users.messages.list({
        userId: "me",
        maxResults: Math.min(50, Math.max(1, Math.floor(max))),
        q,
      });
      const ids = (list.data.messages ?? []).map((m) => m.id ?? "").filter(Boolean);
      const messages: Array<{ id: string; subject: string; from: string; date: string; snippet: string }> = [];
      for (const id of ids) {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = msg.data.payload?.headers ?? [];
        const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n)?.value ?? "";
        messages.push({ id, subject: h("subject"), from: h("from"), date: h("date"), snippet: msg.data.snippet ?? "" });
      }
      return textResult({ ok: true, messages });
    },
  );

  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  process.stderr.write(`world-server fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
