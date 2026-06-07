import { randomBytes } from "node:crypto";
import type { Request } from "express";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/** Read Google OAuth credentials from the environment, if configured. */
export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleConfigured(): boolean {
  return getGoogleConfig() !== null;
}

/** Opaque, single-use value that ties the callback back to this browser (CSRF). */
export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * The callback URL Google redirects back to. Must be registered as an
 * "Authorized redirect URI" in the Google Cloud console. Prefer an explicit
 * `OAUTH_REDIRECT_URI`; otherwise derive it from the (possibly proxied)
 * request so it works in local dev without extra config.
 */
export function resolveRedirectUri(req: Request): string {
  const explicit = process.env.OAUTH_REDIRECT_URI;
  if (explicit) return explicit;

  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const proto = forwardedProto || req.protocol;
  const host = forwardedHost || req.headers.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/**
 * Exchange an authorization code for tokens and resolve the user's profile.
 * Uses Node's global `fetch`; no external SDK required.
 */
export async function exchangeCodeForProfile(opts: {
  config: GoogleConfig;
  code: string;
  redirectUri: string;
}): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.config.clientId,
      client_secret: opts.config.clientSecret,
      code: opts.code,
      grant_type: "authorization_code",
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed (${tokenRes.status})`);
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new Error("Google token response did not include an access token");
  }

  const userRes = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`Google userinfo request failed (${userRes.status})`);
  }

  const info = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!info.sub || !info.email) {
    throw new Error("Google profile is missing a subject or email");
  }

  const email = info.email.trim().toLowerCase();
  return {
    sub: info.sub,
    email,
    emailVerified: Boolean(info.email_verified),
    name: info.name?.trim() || email.split("@")[0],
    picture: info.picture ?? null,
  };
}
