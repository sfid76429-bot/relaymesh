import { Hono } from "hono";
import healthRouter from "./health";
import relayRouter from "./relay";
import type { Env } from "../env";

const router = new Hono<{ Bindings: Env }>();

router.route("/", healthRouter);
router.route("/", relayRouter);

export default router;
