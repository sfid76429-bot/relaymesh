import { Hono } from "hono";
import { cors } from "hono/cors";
import router from "./routes";
import { logger } from "./lib/logger";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  logger.info({
    method: c.req.method,
    url: c.req.path,
    statusCode: c.res.status,
    ms: Date.now() - start,
  });
});

app.route("/api", router);

export default app;
