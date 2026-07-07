import { AgentAction } from "./models/index.js";
import type { AgentActionRow, AuditWriter } from "../types.js";

export { connectDb, disconnectDb, isDbConnected } from "./connection.js";
export * from "./models/index.js";

/** Mongo-backed audit ledger writer for the loop's `ctx.audit`. */
export function createMongoAudit(): AuditWriter {
  return {
    async write(row: AgentActionRow): Promise<void> {
      await AgentAction.create(row);
    },
  };
}
