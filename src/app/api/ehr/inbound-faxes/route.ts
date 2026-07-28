import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"

// Lists received (inbound) faxes for the EHR's Lab Fax Inbox. Called cross-origin
// from the EHR browser, authenticated with the logged-in user's Medplum token.
export const dynamic = "force-dynamic"

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
  if (!(await validateMedplumToken(req.headers.get("authorization") ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS })
  }

  const { searchParams } = new URL(req.url)
  const count = Math.min(200, Math.max(1, parseInt(searchParams.get("_count") ?? "60", 10) || 60))

  const rows = await db.query.faxes.findMany({
    where: and(eq(faxes.direction, "inbound"), isNull(faxes.trashedAt)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: count,
  })

  const list = rows
    .filter((f) => f.fileUrl) // only faxes with a retrievable PDF
    .map((f) => ({
      id: f.id,
      from: f.fromNumber,
      fromName: f.fromName ?? undefined,
      subject: f.subject ?? undefined,
      pages: f.pages ?? undefined,
      fileUrl: f.fileUrl ?? undefined,
      received: (f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt as unknown as string)).toISOString(),
      read: !!f.readAt,
    }))

  return NextResponse.json({ faxes: list }, { headers: CORS })
}
