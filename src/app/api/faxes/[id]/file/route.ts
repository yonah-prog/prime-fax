import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// Proxy a stored fax document through the app so the browser can render it
// without CORS issues and regardless of whether the stored URL requires auth.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!fax.fileUrl) return NextResponse.json({ error: "No file attached" }, { status: 404 })

  const headers: Record<string, string> = {}
  // Telnyx media URLs require Bearer auth; R2 URLs are public — add the header
  // unconditionally since it's harmless on public URLs.
  if (process.env.TELNYX_API_KEY && fax.fileUrl.includes("telnyx")) {
    headers["Authorization"] = `Bearer ${process.env.TELNYX_API_KEY}`
  }

  let upstream: Response
  try {
    upstream = await fetch(fax.fileUrl, { headers })
  } catch {
    return NextResponse.json({ error: "Could not fetch fax file" }, { status: 502 })
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: upstream.status })
  }

  const contentType = upstream.headers.get("content-type") ?? "application/pdf"
  const fileName = fax.fileName ?? "fax.pdf"

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
