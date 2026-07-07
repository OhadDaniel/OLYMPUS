import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * The ONE place `process.env` is read (hard rule). Everything else imports
 * `config`. Reads once at module load, validates with zod, fails fast.
 *
 * Integration credentials (Mongo, Google, Telegram) are NULLISH so the app
 * boots on Day 1 with only an OpenAI key — but `assertConfigured` throws the
 * moment a feature that needs one is used, so nothing ever fakes an
 * integration silently.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

loadEnv({ path: path.resolve(repoRoot, ".env") });

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  MAXWELL_MODEL: z.string().default("gpt-4o"),
  MAXWELL_MAX_TURNS: z.coerce.number().int().min(1).max(100).default(8),

  MONGODB_URI: z.string().nullish(),

  GOOGLE_CLIENT_ID: z.string().nullish(),
  GOOGLE_CLIENT_SECRET: z.string().nullish(),

  TELEGRAM_BOT_TOKEN: z.string().nullish(),

  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:3001"),
  TZ_DEFAULT: z.string().default("Asia/Jerusalem"),

  MAXWELL_LOG: z.enum(["file", "stderr", "stdout", "silent"]).default("file"),
  MAXWELL_LOG_DIR: z.string().default("logs"),
  MAXWELL_SKILLS_DIR: z.string().default("skills"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
  );
  // Throw (don't process.exit) so tests / NestJS get a catchable error;
  // entrypoints (repl, api main) surface it and exit.
  throw new ConfigError(`MAXWELL config invalid:\n${lines.join("\n")}`);
}

const env = parsed.data;

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

export const config = {
  repoRoot,
  openaiApiKey: env.OPENAI_API_KEY,
  model: env.MAXWELL_MODEL,
  maxTurns: env.MAXWELL_MAX_TURNS,

  mongodbUri: env.MONGODB_URI ?? null,

  google: {
    clientId: env.GOOGLE_CLIENT_ID ?? null,
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? null,
    redirectUri: `${env.API_URL}/auth/google/callback`,
    scopes: GOOGLE_SCOPES,
  },

  telegramBotToken: env.TELEGRAM_BOT_TOKEN ?? null,

  appUrl: env.APP_URL,
  apiUrl: env.API_URL,
  tz: env.TZ_DEFAULT,

  logDestination: env.MAXWELL_LOG,
  logDir: path.resolve(repoRoot, env.MAXWELL_LOG_DIR),
  skillsDir: path.resolve(repoRoot, env.MAXWELL_SKILLS_DIR),
} as const;

/** Single user — but code NEVER assumes singleton; always filter by userId. */
export const USER_ID = "ohad" as const;

/**
 * Assert an optional credential is present at feature-use. Throws a clear
 * ConfigError naming the missing env var — the "never fake integrations
 * silently" rule, enforced.
 */
export function assertConfigured(value: string | null | undefined, envName: string): string {
  if (!value) {
    throw new ConfigError(
      `${envName} is not set. This feature needs it — add ${envName} to your .env and restart.`,
    );
  }
  return value;
}
