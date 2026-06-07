import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

import { db, pool } from "./index";
import { usersTable, type UserRole } from "./schema";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Mirrors `hashPassword` in artifacts/api-server/src/lib/auth.ts so that the
 * seeded accounts can log in through the normal password flow.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

const TEST_USERS: SeedUser[] = [
  {
    email: "teacher@stepcheck.test",
    password: "Teacher123!",
    name: "Tina Teacher",
    role: "teacher",
  },
  {
    email: "student@stepcheck.test",
    password: "Student123!",
    name: "Sam Student",
    role: "student",
  },
];

async function main(): Promise<void> {
  console.log("Seeding test accounts…\n");

  for (const user of TEST_USERS) {
    const passwordHash = await hashPassword(user.password);

    // Idempotent: re-running resets the password/name/role for these emails.
    await db
      .insert(usersTable)
      .values({
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
      })
      .onConflictDoUpdate({
        target: usersTable.email,
        set: { passwordHash, name: user.name, role: user.role },
      });

    console.log(
      `  ✓ ${user.role.padEnd(7)} ${user.email}  ·  password: ${user.password}`,
    );
  }

  console.log("\nDone. These are demo credentials — do not use real passwords.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
