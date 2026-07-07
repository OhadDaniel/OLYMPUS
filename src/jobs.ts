import { Job } from "./db/models/index.js";

/**
 * Idempotency ledger. `claimJob` returns true only the FIRST time a key is
 * seen (the unique index makes the insert fail on repeats) — the only
 * double-send protection for Telegram, which has none of its own.
 */
export async function claimJob(userId: string, key: string, payload?: unknown): Promise<boolean> {
  try {
    await Job.create({ userId, key, status: "claimed", payload });
    return true;
  } catch {
    return false; // duplicate key → already claimed/processed
  }
}

export async function markJob(key: string, status: "done" | "failed"): Promise<void> {
  await Job.updateOne({ key }, { $set: { status } });
}

/** Release a claimed key so it can be retried (e.g. a send that no-op'd). */
export async function releaseJob(key: string): Promise<void> {
  await Job.deleteOne({ key });
}
