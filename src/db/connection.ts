import mongoose from "mongoose";
import { assertConfigured, config } from "../config.js";

let connPromise: Promise<typeof mongoose> | null = null;

/** Connect once (idempotent). Throws a clear error if MONGODB_URI is unset. */
export async function connectDb(): Promise<typeof mongoose> {
  if (connPromise) return connPromise;
  const uri = assertConfigured(config.mongodbUri, "MONGODB_URI");
  mongoose.set("strictQuery", true);
  connPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: true,
  });
  return connPromise;
}

export async function disconnectDb(): Promise<void> {
  if (connPromise) {
    await mongoose.disconnect();
    connPromise = null;
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
