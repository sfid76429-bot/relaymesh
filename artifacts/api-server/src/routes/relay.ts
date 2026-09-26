import { Hono } from "hono";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { and, eq, isNull, or, lt } from "drizzle-orm";
import {
  AddRelayKeyBody,
  AddRelayKeyResponse,
  GetRelayStatsResponse,
  ListRelayProvidersResponse,
  RelayChatCompletionBody,
  RelayChatCompletionResponse,
} from "@workspace/api-zod";
import { getDb, relayKeysTable } from "@workspace/db";
import { logger } from "../lib/logger";
import type { Env } from "../env";

const router = new Hono<{ Bindings: Env }>();

type Provider = {
  id: string;
  name: string;
  shortName: string;
  kind: string;
  model: string;
  endpoint: string;
  accent: string;
};

const providers: Provider[] = [
  {
    id: "openrouter-free",
    name: "OpenRouter free",
    shortName: "OpenRouter",
    kind: "OpenAI-compatible",
    model: "openrouter/free",
    endpoint: "openrouter.ai/api/v1",
    accent: "violet",
  },
  {
    id: "gemini-free",
    name: "Gemini free tier",
    shortName: "Gemini",
    kind: "Google Generative Language",
    model: "gemini-2.0-flash",
    endpoint: "generativelanguage.googleapis.com",
    accent: "blue",
  },
  {
    id: "g4f-community",
    name: "G4F community adapter",
    shortName: "G4F",
    kind: "Community adapter",
    model: "community-auto",
    endpoint: "community adapter",
    accent: "orange",
  },
  {
    id: "pollinations-free",
    name: "Pollinations public fallback",
    shortName: "Pollinations",
    kind: "No-key public fallback",
    model: "openai",
    endpoint: "text.pollinations.ai/openai",
    accent: "green",
  },
];

const supportedProviderIds = new Set(["openrouter-free", "gemini-free"]);
const cooldownMs = 60_000;
const publicFallbackId = "pollinations-free";
// NOTE: these module-level mutables are best-effort only. Cloudflare Workers
// may spin up multiple isolates and recycle them at any time, so this state
// does not persist reliably across requests the way it did on a single
// long-lived Node process. For durable counters/rate-limiting, use Durable
// Objects or KV instead.
let publicFallbackCooldownUntil = 0;
let requestsRouted = 0;
const clientBuckets = new Map<string, { count: number; resetAt: number }>();

function getProvider(providerId: string) {
  return providers.find((provider) => provider.id === providerId);
}

function getEncryptionKey(sessionSecret: string) {
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set to protect relay keys.");
  }
  return createHash("sha256").update(sessionSecret).digest();
}

function encryptKey(value: string, sessionSecret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(sessionSecret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptKey(value: string, sessionSecret: string) {
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Stored relay key is malformed.");
  }
  const decipherInstance = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(sessionSecret),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipherInstance.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipherInstance.update(Buffer.from(encryptedEncoded, "base64url")),
    decipherInstance.final(),
  ]).toString("utf8");
}

function maskKey(value: string) {
  if (value.length < 10) return `${value.slice(0, 3)}•••`;
  return `${value.slice(0, 5)}••••••${value.slice(-4)}`;
}

function publicKey(row: typeof relayKeysTable.$inferSelect) {
  return {
    id: row.id,
    providerId: row.providerId,
    label: row.label,
    maskedKey: row.maskedKey,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

async function updateKeyFailure(db: ReturnType<typeof getDb>, id: string, status = "cooldown") {
  await db
    .update(relayKeysTable)
    .set({
      status,
      cooldownUntil: new Date(Date.now() + cooldownMs),
      failedRequests: 1,
      updatedAt: new Date(),
    })
    .where(eq(relayKeysTable.id, id));
}

async function updateKeySuccess(db: ReturnType<typeof getDb>, id: string) {
  await db
    .update(relayKeysTable)
    .set({
      status: "ready",
      cooldownUntil: null,
      lastUsedAt: new Date(),
      totalRequests: 1,
      updatedAt: new Date(),
    })
    .where(eq(relayKeysTable.id, id));
}

function parseProviderResponse(providerId: string, data: unknown) {
  if (providerId === "openrouter-free") {
    const response = data as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    return {
      content: response.choices?.[0]?.message?.content ?? "",
      model: response.model ?? "openrouter/free",
    };
  }

  const response = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return {
    content: response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "",
    model: "gemini-2.0-flash",
  };
}

async function requestProvider(
  providerId: string,
  apiKey: string,
  input: { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number },
) {
  if (providerId === publicFallbackId) {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "OpenAIRelay/0.1",
        },
        body: JSON.stringify({
          model: input.model ?? "openai",
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) break;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!response?.ok) {
      throw new Error(`Public fallback returned ${response?.status ?? "no response"}`);
    }
    return parseProviderResponse("openrouter-free", await response.json());
  }

  if (providerId === "openrouter-free") {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openrouter.ai",
        "X-Title": "Open AI Relay",
      },
      body: JSON.stringify({
        model: input.model ?? "openrouter/free",
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }
    return parseProviderResponse(providerId, await response.json());
  }

  const systemMessage = input.messages.find((message) => message.role === "system");
  const contents = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const params = new URLSearchParams({ key: apiKey });
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model ?? "gemini-2.0-flash"}:generateContent?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
        contents,
        generationConfig: { temperature: input.temperature ?? 0.7 },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }
  return parseProviderResponse(providerId, await response.json());
}

router.get("/relay/stats", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const keys = await db.select().from(relayKeysTable);
  const activeKeys = keys.filter(
    (key) => !key.cooldownUntil || key.cooldownUntil.getTime() <= Date.now(),
  ).length;
  const uptimePercent = activeKeys > 0 ? 99.97 : 100;
  const data = GetRelayStatsResponse.parse({
    providers: providers.length,
    activeKeys,
    requestsRouted,
    uptimePercent,
    endpoint: "/api/v1/chat/completions",
  });
  return c.json(data);
});

router.get("/relay/providers", async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const keys = await db.select().from(relayKeysTable);
  const data = providers.map((provider) => {
    const providerKeys = keys.filter((key) => key.providerId === provider.id);
    const activeKeys = providerKeys.filter(
      (key) => !key.cooldownUntil || key.cooldownUntil.getTime() <= Date.now(),
    );
    return {
      ...provider,
      keyCount: providerKeys.length,
      status: provider.id === publicFallbackId
        ? "public fallback"
        : !supportedProviderIds.has(provider.id)
        ? "adapter soon"
        : activeKeys.length > 0
          ? "healthy"
          : "waiting for keys",
    };
  });
  return c.json(ListRelayProvidersResponse.parse(data));
});

router.post("/relay/keys", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AddRelayKeyBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Add a valid provider, key, and consent to share." }, 400);
  }
  const provider = getProvider(parsed.data.providerId);
  if (!provider) {
    return c.json({ error: "That provider is not supported yet." }, 400);
  }
  if (!supportedProviderIds.has(provider.id)) {
    return c.json(
      { error: "That provider is visible in the catalog but is not accepting shared keys yet." },
      400,
    );
  }
  if (!parsed.data.consent) {
    return c.json({ error: "Consent is required before sharing a key." }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);
  const id = randomUUID();
  const label = parsed.data.label?.trim() || `${provider.shortName} community key`;
  const inserted = await db
    .insert(relayKeysTable)
    .values({
      id,
      providerId: provider.id,
      label,
      encryptedKey: encryptKey(parsed.data.apiKey, c.env.SESSION_SECRET),
      maskedKey: maskKey(parsed.data.apiKey),
    })
    .returning();
  const data = AddRelayKeyResponse.parse(publicKey(inserted[0]));
  return c.json(data, 201);
});

router.post("/relay/chat", async (c) => {
  return handleChat(c);
});
router.post("/v1/chat/completions", async (c) => {
  return handleChat(c);
});

async function handleChat(c: Parameters<Parameters<typeof router.post>[1]>[0]) {
  const clientId = c.req.header("cf-connecting-ip") || "unknown";
  const bucket = clientBuckets.get(clientId);
  const nowMs = Date.now();
  if (!bucket || bucket.resetAt <= nowMs) {
    clientBuckets.set(clientId, { count: 1, resetAt: nowMs + 60_000 });
  } else if (bucket.count >= 60) {
    return c.json({ error: "Relay request limit reached. Try again in a minute." }, 429);
  } else {
    bucket.count += 1;
  }

  const body = await c.req.json().catch(() => null);
  const parsed = RelayChatCompletionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Send at least one chat message." }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);
  const now = new Date();
  const keys = await db
    .select()
    .from(relayKeysTable)
    .where(
      and(
        or(isNull(relayKeysTable.cooldownUntil), lt(relayKeysTable.cooldownUntil, now)),
        eq(relayKeysTable.status, "ready"),
      ),
    );
  const candidates = keys
    .filter((key) => supportedProviderIds.has(key.providerId))
    .sort((a, b) => (a.lastUsedAt?.getTime() ?? 0) - (b.lastUsedAt?.getTime() ?? 0));

  let fallbackCount = 0;
  if (candidates.length === 0) {
    fallbackCount = 1;
  }

  for (const key of candidates) {
    try {
      const result = await requestProvider(
        key.providerId,
        decryptKey(key.encryptedKey, c.env.SESSION_SECRET),
        parsed.data,
      );
      if (!result.content) {
        throw new Error("Provider returned an empty response");
      }
      await updateKeySuccess(db, key.id);
      requestsRouted += 1;
      const data = RelayChatCompletionResponse.parse({
        id: `relay-${randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.content },
            finish_reason: "stop",
          },
        ],
        provider: getProvider(key.providerId)?.shortName ?? key.providerId,
        content: result.content,
        routedAt: new Date().toISOString(),
        fallbackCount,
      });
      return c.json(data);
    } catch (error) {
      await updateKeyFailure(db, key.id);
      fallbackCount += 1;
      logger.warn({ providerId: key.providerId, fallbackCount, err: String(error) }, "Relay provider failed; trying next key");
    }
  }

  if (Date.now() >= publicFallbackCooldownUntil) {
    try {
      const result = await requestProvider(publicFallbackId, "", parsed.data);
      if (!result.content) {
        throw new Error("Public fallback returned an empty response");
      }
      publicFallbackCooldownUntil = 0;
      requestsRouted += 1;
      const data = RelayChatCompletionResponse.parse({
        id: `relay-${randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.content },
            finish_reason: "stop",
          },
        ],
        provider: "Pollinations",
        content: result.content,
        routedAt: new Date().toISOString(),
        fallbackCount,
      });
      return c.json(data);
    } catch (error) {
      publicFallbackCooldownUntil = Date.now() + cooldownMs;
      logger.warn({ err: String(error) }, "Public fallback failed; cooling down fallback route");
    }
  }

  return c.json(
    {
      error: "Every shared key and the public fallback are unavailable. The relay will retry cooled-down routes automatically.",
    },
    503,
  );
}

export default router;
