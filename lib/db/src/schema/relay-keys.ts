import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const relayKeysTable = pgTable("relay_keys", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  label: text("label").notNull().default("Community key"),
  encryptedKey: text("encrypted_key").notNull(),
  maskedKey: text("masked_key").notNull(),
  status: text("status").notNull().default("ready"),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  totalRequests: integer("total_requests").notNull().default(0),
  failedRequests: integer("failed_requests").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRelayKeySchema = createInsertSchema(relayKeysTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertRelayKey = z.infer<typeof insertRelayKeySchema>;
export type RelayKey = typeof relayKeysTable.$inferSelect;