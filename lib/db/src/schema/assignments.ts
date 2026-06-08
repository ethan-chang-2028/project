import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { classesTable } from "./classes";

/**
 * A piece of work a teacher assigns to a class. It holds the framing
 * (title + instructions); the graded content lives in `problems`.
 */
export const assignmentsTable = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Fields a teacher supplies when creating an assignment. */
export const insertAssignmentSchema = createInsertSchema(assignmentsTable, {
  title: (schema) => schema.min(1),
}).pick({ title: true, instructions: true, dueAt: true });

export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
