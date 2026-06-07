import type { ErrorRequestHandler, RequestHandler } from "express";

import { logger } from "../lib/logger";

/**
 * JSON 404 for unmatched API routes, so clients always get
 * `{ error }` instead of Express's default HTML page.
 */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

/**
 * Final error handler. Express recognises error middleware by its
 * four-argument signature, so `next` must stay even though it's unused.
 *
 * Logs the real error server-side and returns a generic message — never the
 * stack trace or SQL, which must not leak to clients.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
