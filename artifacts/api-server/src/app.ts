import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";
import { errorHandler, notFound } from "./middlewares/errorHandler";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// `origin: true` reflects the request origin and, together with
// `credentials: true`, allows browsers to send the session cookie.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);

app.use("/api", router);

// Unmatched API routes -> JSON 404; any thrown/rejected error -> JSON 500.
// Both must come after the routes. The error handler also prevents internal
// errors (stack traces, SQL) from leaking to clients.
app.use("/api", notFound);
app.use(errorHandler);

export default app;
