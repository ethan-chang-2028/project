import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
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
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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

    // Always run a hash comparison to avoid leaking which emails exist via timing.
    const ok = user
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

export default router;
