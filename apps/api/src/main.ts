import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config } from "../../../src/config.js";
import { connectDb } from "../../../src/db/index.js";
import { WorldMcpClient } from "../../../src/tools/mcp-client.js";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  if (config.mongodbUri) await connectDb();

  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.enableCors({ origin: config.appUrl, credentials: true });

  const port = Number(new URL(config.apiUrl).port || 3001);
  await app.listen(port);
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
