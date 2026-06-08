import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

/**
 * A class owned by a teacher. Students join it with the short `joinCode`.
 */
export const classesTable = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Short human-friendly code students type to enrol (unique).
  joinCode: text("join_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Fields a teacher supplies when creating a class. */
export const insertClassSchema = createInsertSchema(classesTable, {
  name: (schema) => schema.min(1),
}).pick({ name: true });

export const classSchema = createSelectSchema(classesTable);

export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classesTable.$inferSelect;
