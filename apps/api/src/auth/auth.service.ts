import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { USER_ID } from "../../../../src/config.js";
import { buildAuthUrl, exchangeCode, isGoogleConnected } from "../../../../src/google/oauth.js";

@Injectable()
export class AuthService {
  // Single-process CSRF nonce store for the OAuth `state` param.
  private readonly nonces = new Set<string>();

  startUrl(): string {
    const state = randomBytes(16).toString("base64url");
    this.nonces.add(state);
    return buildAuthUrl(state);
  }

  async complete(state: string, code: string): Promise<boolean> {
    if (!this.nonces.delete(state)) return false; // unknown/expired state
    await exchangeCode(USER_ID, code);
    return true;
  }

  status(): Promise<boolean> {
    return isGoogleConnected(USER_ID);
  }
}
