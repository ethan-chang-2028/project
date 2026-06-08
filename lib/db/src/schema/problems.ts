import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

import { assignmentsTable } from "./assignments";

/**
 * One graded step of a problem: what the student is asked for (`prompt`) and
 * the expected result (`answer`, i.e. the answer key for that step).
 */
export const problemStepSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string().min(1),
});

export type ProblemStep = z.infer<typeof problemStepSchema>;

/**
 * A step-based problem inside an assignment. The ordered `steps` array is the
 * answer key the grader checks student work against.
 */
export const problemsTable = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignmentsTable.id, { onDelete: "cascade" }),
  // Ordering within the assignment.
  position: integer("position").notNull().default(0),
  // The problem stem shown to the student.
  prompt: text("prompt").notNull(),
  steps: jsonb("steps").$type<ProblemStep[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Fields a teacher supplies when authoring a problem. */
export const insertProblemSchema = z.object({
  prompt: z.string().min(1),
  steps: z.array(problemStepSchema).min(1),
});

export type InsertProblem = z.infer<typeof insertProblemSchema>;
export type Problem = typeof problemsTable.$inferSelect;
