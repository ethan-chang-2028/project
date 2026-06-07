import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { LoginBody, SignupBody } from "@workspace/api-zod";

import {
  SESSION_COOKIE,
  createSession,
  hashPassword,
  revokeSession,
  sessionCookieOptions,
  toAuthUser,
  verifyPassword,
} from "../lib/auth";
import {
  buildAuthUrl,
  exchangeCodeForProfile,
  generateState,
  getGoogleConfig,
  resolveRedirectUri,
  type GoogleProfile,
} from "../lib/google";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const isProduction = process.env.NODE_ENV === "production";

/** Short-lived cookie that carries the OAuth `state` plus the redirect URI. */
const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_COOKIE_PATH = "/api/auth/google";

/** Where to send the browser after a successful / failed sign-in. */
function postLoginRedirect(): string {
  return process.env.APP_POST_LOGIN_REDIRECT ?? "/dashboard";
}
function loginRedirect(error: string): string {
  const base = process.env.APP_LOGIN_REDIRECT ?? "/login";
  return `${base}?error=${encodeURIComponent(error)}`;
}

/** Postgres unique-violation error code. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Detect a Postgres unique-constraint violation. Drizzle wraps the driver
 * error, so the `code` may live on the thrown error or on its `cause`.
 */
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
    if ((current as { code?: string }).code === PG_UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

router.post("/auth/signup", async (req, res, next) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { email, password, name, role } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        ...(role ? { role } : {}),
      })
      .returning();

    const { token, expiresAt } = await createSession(user.id);
    res
      .cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
      .status(201)
      .json(toAuthUser(user));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "An account with that email already exists" });
      return;
    }
    next(err);
  }
});

router.post("/auth/login", async (req, res, next) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.trim().toLowerCase()))
      .limit(1);

    // Always run a hash comparison to avoid leaking which emails exist via
    // timing. Accounts created via Google have no password hash.
    const ok = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, "0:0");

    if (!user || !ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const { token, expiresAt } = await createSession(user.id);
    res
      .cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
      .status(200)
      .json(toAuthUser(user));
  } catch (err) {
    next(err);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    if (req.sessionToken) await revokeSession(req.sessionToken);
    res.clearCookie(SESSION_COOKIE, { path: "/" }).status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  // `requireAuth` guarantees `req.user` is set.
  res.json(toAuthUser(req.user!));
});

// ---------------------------------------------------------------------------
// Google sign-in (OAuth 2.0 authorization-code flow)
// ---------------------------------------------------------------------------

/** Begin the flow: redirect the browser to Google's consent screen. */
router.get("/auth/google", (req, res) => {
  const config = getGoogleConfig();
  if (!config) {
    res.redirect(loginRedirect("google_not_configured"));
    return;
  }

  const state = generateState();
  const redirectUri = resolveRedirectUri(req);

  // Persist the state + the exact redirect URI used, so the callback can
  // verify the former and reuse the latter for the token exchange.
  const cookieValue = `${state}|${Buffer.from(redirectUri).toString("base64url")}`;
  res.cookie(OAUTH_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(buildAuthUrl({ clientId: config.clientId, redirectUri, state }));
});

/** Finish the flow: validate state, exchange the code, sign the user in. */
router.get("/auth/google/callback", async (req, res, next) => {
  const config = getGoogleConfig();
  if (!config) {
    res.redirect(loginRedirect("google_not_configured"));
    return;
  }

  const cookie = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_COOKIE_PATH });

  const { code, state, error } = req.query;
  if (typeof error === "string" && error) {
    res.redirect(loginRedirect(error));
    return;
  }
  if (typeof code !== "string" || typeof state !== "string" || !cookie) {
    res.redirect(loginRedirect("google_failed"));
    return;
  }

  const [savedState, savedRedirectB64] = cookie.split("|");
  if (!savedState || savedState !== state) {
    res.redirect(loginRedirect("google_state_mismatch"));
    return;
  }
  const redirectUri = savedRedirectB64
    ? Buffer.from(savedRedirectB64, "base64url").toString("utf8")
    : resolveRedirectUri(req);

  try {
    const profile = await exchangeCodeForProfile({ config, code, redirectUri });
    const user = await findOrCreateGoogleUser(profile);
    const { token, expiresAt } = await createSession(user.id);
    res
      .cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
      .redirect(postLoginRedirect());
  } catch (err) {
    logger.error({ err }, "Google sign-in failed");
    res.redirect(loginRedirect("google_failed"));
  }
});

/**
 * Resolve a Google profile to a user: match by Google id, else link an
 * existing account with the same email, else create a new account.
 */
async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
  const [byGoogleId] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.googleId, profile.sub))
    .limit(1);
  if (byGoogleId) return byGoogleId;

  const [byEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, profile.email))
    .limit(1);
  if (byEmail) {
    const [linked] = await db
      .update(usersTable)
      .set({
        googleId: profile.sub,
        avatarUrl: byEmail.avatarUrl ?? profile.picture,
      })
      .where(eq(usersTable.id, byEmail.id))
      .returning();
    return linked;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      email: profile.email,
      name: profile.name,
      googleId: profile.sub,
      avatarUrl: profile.picture,
      passwordHash: null,
    })
    .returning();
  return created;
}

export default router;
