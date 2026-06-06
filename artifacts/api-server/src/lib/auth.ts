import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";
import {
  db,
  sessionsTable,
  usersTable,
  type PublicUser,
  type User,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** Name of the cookie that carries the opaque session token. */
export const SESSION_COOKIE = "session";

/** Sessions live for 30 days of inactivity-independent absolute lifetime. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Derive a salted scrypt hash for a plaintext password. The returned string
 * embeds the salt: `"<saltHex>:<hashHex>"`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verification of a plaintext password against a stored hash. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/** Hash the cookie token so the database never stores a replayable secret. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Create a persisted session for a user and return the raw cookie token. */
export async function createSession(userId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({
    id: hashToken(token),
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Resolve a cookie token to its user, or `null` when the session is missing or
 * expired. Expired sessions are pruned on access.
 */
export async function validateSession(token: string): Promise<PublicUser | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ user: usersTable, expiresAt: sessionsTable.expiresAt })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.id, id))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
    return null;
  }

  return toPublicUser(row.user);
}

/** Revoke a session by its cookie token (no-op if it does not exist). */
export async function revokeSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, hashToken(token)));
}

/** Cookie options shared by the routes that set the session cookie. */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

/** Strip the password hash from a user row. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/** Project a user into the API's `AuthUser` response shape. */
export function toAuthUser(user: PublicUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
