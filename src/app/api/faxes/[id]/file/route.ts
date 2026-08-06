import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { downloadFaxFile } from "@/lib/storage"

// Proxy a stored fax document through the app so the browser can render it
// without CORS issues. Fetching is delegated to downloadFaxFile, which pulls
// R2 objects via the credentialed SDK and external URLs over plain HTTP (no
// Authorization header — Telnyx's media URLs are pre-signed S3 links that
// reject an extra auth header).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!fax.fileUrl) return NextResponse.json({ error: "No file attached" }, { status: 404 })

  const buf = await downloadFaxFile(fax.fileUrl)
  if (!buf) {
    // The source is gone (e.g. a legacy inbound fax whose temporary Telnyx URL
    // expired before it was re-hosted). Surface a clear, honest message.
    return NextResponse.json(
      { error: "This fax file is no longer available." },
      { status: 410 }
    )
  }

  const fileName = fax.fileName ?? "fax.pdf"
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
