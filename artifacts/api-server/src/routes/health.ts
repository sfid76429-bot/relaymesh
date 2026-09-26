import { Hono } from "hono";
import { HealthCheckResponse } from "@workspace/api-zod";
import type { Env } from "../env";

const router = new Hono<{ Bindings: Env }>();

router.get("/healthz", (c) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  return c.json(data);
});

export default router;
