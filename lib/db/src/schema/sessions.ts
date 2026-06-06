import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Opaque server-side sessions. The primary key is the SHA-256 hash of the
 * cookie token, so a leaked database row cannot be replayed as a live cookie.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export type Session = typeof sessionsTable.$inferSelect;
