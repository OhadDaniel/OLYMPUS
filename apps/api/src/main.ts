import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config } from "../../../src/config.js";
import { connectDb } from "../../../src/db/index.js";
import { WorldMcpClient } from "../../../src/tools/mcp-client.js";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  if (config.mongodbUri) await connectDb();

  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  // Allow the deployed front end (APP_URL) plus local dev origins.
  app.enableCors({
    origin: [config.appUrl, "http://localhost:5273", "http://localhost:5173"],
    credentials: true,
  });

  // Hosts (Render/Railway/Fly) inject $PORT; fall back to the API_URL port locally.
  const port = Number(process.env.PORT) || Number(new URL(config.apiUrl).port || 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`maxwell-api listening on ${config.apiUrl} (mongo=${config.mongodbUri ? "on" : "off"})`);

  // Spawn the read-only MCP world-server (best-effort; native tools work regardless).
  app
    .get(WorldMcpClient)
    .connect()
    .then(() => console.log("mcp world-server connected"))
    .catch((e: unknown) => console.error("mcp world-server connect failed:", e instanceof Error ? e.message : e));
}

void bootstrap();
