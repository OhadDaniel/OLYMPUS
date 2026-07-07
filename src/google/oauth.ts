import { google } from "googleapis";
import { assertConfigured, config } from "../config.js";
import { GoogleToken } from "../db/models/index.js";

// Infer the client type from googleapis itself to avoid the duplicate
// google-auth-library type clash (two copies in the dep tree).
type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

/** A fresh OAuth2 client configured with our credentials + redirect. */
export function oauthClient(): GoogleOAuthClient {
  const clientId = assertConfigured(config.google.clientId, "GOOGLE_CLIENT_ID");
  const clientSecret = assertConfigured(config.google.clientSecret, "GOOGLE_CLIENT_SECRET");
  return new google.auth.OAuth2(clientId, clientSecret, config.google.redirectUri);
}

/** Consent URL — offline + forced consent so we always receive a refresh token. */
export function buildAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...config.google.scopes],
    state,
    include_granted_scopes: true,
  });
}

/** Exchange the callback code and persist the refresh token (upsert per user). */
export async function exchangeCode(userId: string, code: string): Promise<void> {
  const { tokens } = await oauthClient().getToken(code);
  const set: Record<string, unknown> = {
    scopes: tokens.scope ? tokens.scope.split(" ") : [...config.google.scopes],
  };
  if (tokens.refresh_token) set.refreshToken = tokens.refresh_token;
  if (tokens.access_token) set.accessToken = tokens.access_token;
  if (tokens.expiry_date) set.expiryDate = tokens.expiry_date;
  await GoogleToken.updateOne({ userId }, { $set: set }, { upsert: true });
}

/** An authorized client that auto-refreshes; refreshed tokens persist to Mongo. */
export async function getAuthedClient(userId: string): Promise<GoogleOAuthClient> {
  const doc = await GoogleToken.findOne({ userId }).lean();
  if (!doc?.refreshToken) {
    throw new Error("Google is not connected. Complete the OAuth consent first.");
  }
  const client = oauthClient();
  client.setCredentials({
    refresh_token: doc.refreshToken,
    ...(doc.accessToken ? { access_token: doc.accessToken } : {}),
    ...(doc.expiryDate ? { expiry_date: doc.expiryDate } : {}),
  });
  client.on("tokens", (t) => {
    const set: Record<string, unknown> = {};
    if (t.access_token) set.accessToken = t.access_token;
    if (t.expiry_date) set.expiryDate = t.expiry_date;
    if (t.refresh_token) set.refreshToken = t.refresh_token;
    if (Object.keys(set).length > 0) void GoogleToken.updateOne({ userId }, { $set: set });
  });
  return client;
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const doc = await GoogleToken.findOne({ userId }).lean();
  return Boolean(doc?.refreshToken);
}
