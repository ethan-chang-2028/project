import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { PublicUser, UserRole } from "@workspace/db";

import { SESSION_COOKIE, validateSession } from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `attachUser` / `requireAuth` when a valid session exists. */
      user?: PublicUser;
      /** The raw session cookie token, when present. */
      sessionToken?: string;
    }
  }
}

/**
 * Resolve the session cookie (if any) and attach the user to the request.
 * Never rejects — unauthenticated requests simply continue with `req.user`
 * unset. Mount this before routes that want optional auth.
 */
export const attachUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token.length > 0) {
      req.sessionToken = token;
      const user = await validateSession(token);
      if (user) req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
};

/** Guard that returns 401 unless a valid session is present. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/** Guard that returns 401 if unauthenticated, or 403 if the role doesn't match. */
export function requireRole(role: UserRole): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
