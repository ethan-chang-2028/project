import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * The two kinds of account the platform supports. Mirrors the student /
 * teacher split described in the product spec.
 */
export const userRoleEnum = pgEnum("user_role", ["student", "teacher"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // scrypt-derived hash (`salt:hash` hex). Never returned to clients.
  // Nullable: accounts created via an OAuth provider have no password.
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  // Google OpenID `sub` for accounts linked to Google sign-in.
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Shape accepted when creating a user (server hashes the raw password). */
export const insertUserSchema = createInsertSchema(usersTable, {
  email: (schema) => schema.email(),
  name: (schema) => schema.min(1),
}).omit({ id: true, passwordHash: true, createdAt: true });

/** Public view of a user — safe to serialise to API clients. */
export const publicUserSchema = createSelectSchema(usersTable).omit({
  passwordHash: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
