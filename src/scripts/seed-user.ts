/**
 * Creates an initial user. Run once after migrations:
 *   npx tsx src/scripts/seed-user.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { db } from "../lib/db"
import { users } from "../lib/db/schema"
import bcrypt from "bcryptjs"

const EMAIL = process.env.SEED_EMAIL ?? "admin@caretend.com"
const PASSWORD = process.env.SEED_PASSWORD ?? "changeme"

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  await db.insert(users).values({ name: "Admin", email: EMAIL, passwordHash, role: "admin" }).onConflictDoNothing()
  console.log(`User created: ${EMAIL}`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
