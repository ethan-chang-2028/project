import { randomInt } from "node:crypto";

import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  assignmentsTable,
  classesTable,
  problemsTable,
  type Class,
} from "@workspace/db";
import {
  CreateAssignmentBody,
  CreateClassBody,
  CreateProblemBody,
} from "@workspace/api-zod";

import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// The teacher guard (`requireAuth, requireRole("teacher")`) is applied per
// route below rather than via a path-less `router.use`, so that unmatched
// `/api/*` paths fall through to the 404 handler instead of being answered
// with 401/403 by this router.

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; current && typeof current === "object" && i < 5; i++) {
    if ((current as { code?: string }).code === PG_UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unambiguous alphabet (no 0/O/1/I/L) for student-facing join codes.
const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)];
  }
  return code;
}

/** Normalise an Express path param (typed `string | string[]`) to a string. */
function paramStr(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Load a class only if it belongs to the given teacher. */
async function loadOwnedClass(
  classIdParam: string | string[],
  teacherId: string,
): Promise<Class | null> {
  const classId = paramStr(classIdParam);
  if (!UUID_RE.test(classId)) return null;
  const [cls] = await db
    .select()
    .from(classesTable)
    .where(and(eq(classesTable.id, classId), eq(classesTable.teacherId, teacherId)))
    .limit(1);
  return cls ?? null;
}

// --- Classes ---------------------------------------------------------------

router.get("/classes", requireAuth, requireRole("teacher"), async (req, res, next) => {
  try {
    const classes = await db
      .select()
      .from(classesTable)
      .where(eq(classesTable.teacherId, req.user!.id))
      .orderBy(desc(classesTable.createdAt));
    res.json(classes);
  } catch (err) {
    next(err);
  }
});

router.post("/classes", requireAuth, requireRole("teacher"), async (req, res, next) => {
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  try {
    const teacherId = req.user!.id;
    const name = parsed.data.name.trim();

    // Retry a few times in the unlikely event of a join-code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [cls] = await db
          .insert(classesTable)
          .values({ teacherId, name, joinCode: generateJoinCode() })
          .returning();
        res.status(201).json(cls);
        return;
      } catch (err) {
        if (isUniqueViolation(err)) continue;
        throw err;
      }
    }
    res.status(500).json({ error: "Could not generate a unique join code" });
  } catch (err) {
    next(err);
  }
});

router.get("/classes/:classId", requireAuth, requireRole("teacher"), async (req, res, next) => {
  try {
    const cls = await loadOwnedClass(req.params.classId, req.user!.id);
    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    res.json(cls);
  } catch (err) {
    next(err);
  }
});

// --- Assignments -----------------------------------------------------------

router.get("/classes/:classId/assignments", requireAuth, requireRole("teacher"), async (req, res, next) => {
  try {
    const cls = await loadOwnedClass(req.params.classId, req.user!.id);
    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.classId, cls.id))
      .orderBy(desc(assignmentsTable.createdAt));
    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

router.post("/classes/:classId/assignments", requireAuth, requireRole("teacher"), async (req, res, next) => {
  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  try {
    const cls = await loadOwnedClass(req.params.classId, req.user!.id);
    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    const [assignment] = await db
      .insert(assignmentsTable)
      .values({
        classId: cls.id,
        title: parsed.data.title.trim(),
        instructions: parsed.data.instructions ?? "",
        dueAt: parsed.data.dueAt ?? null,
      })
      .returning();
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});

// --- Assignment detail + problems -----------------------------------------

/** Load an assignment plus its owning class, enforcing teacher ownership. */
async function loadOwnedAssignment(
  assignmentIdParam: string | string[],
  teacherId: string,
) {
  const assignmentId = paramStr(assignmentIdParam);
  if (!UUID_RE.test(assignmentId)) return null;
  const [row] = await db
    .select({ assignment: assignmentsTable, teacherId: classesTable.teacherId })
    .from(assignmentsTable)
    .innerJoin(classesTable, eq(assignmentsTable.classId, classesTable.id))
    .where(eq(assignmentsTable.id, assignmentId))
    .limit(1);
  if (!row || row.teacherId !== teacherId) return null;
  return row.assignment;
}

router.get("/assignments/:assignmentId", requireAuth, requireRole("teacher"), async (req, res, next) => {
  try {
    const assignment = await loadOwnedAssignment(req.params.assignmentId, req.user!.id);
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    const problems = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.assignmentId, assignment.id))
      .orderBy(asc(problemsTable.position), asc(problemsTable.createdAt));
    res.json({ ...assignment, problems });
  } catch (err) {
    next(err);
  }
});

router.post("/assignments/:assignmentId/problems", requireAuth, requireRole("teacher"), async (req, res, next) => {
  const parsed = CreateProblemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  try {
    const assignment = await loadOwnedAssignment(req.params.assignmentId, req.user!.id);
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    // Append after existing problems.
    const existing = await db
      .select({ position: problemsTable.position })
      .from(problemsTable)
      .where(eq(problemsTable.assignmentId, assignment.id));
    const nextPosition = existing.reduce((max, p) => Math.max(max, p.position + 1), 0);

    const [problem] = await db
      .insert(problemsTable)
      .values({
        assignmentId: assignment.id,
        position: nextPosition,
        prompt: parsed.data.prompt.trim(),
        steps: parsed.data.steps,
      })
      .returning();
    res.status(201).json(problem);
  } catch (err) {
    next(err);
  }
});

export default router;
