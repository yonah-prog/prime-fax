import { auth } from "@/auth"
import { db } from "@/lib/db"
import { coverSheetTemplates } from "@/lib/db/schema"
import { uploadToR2 } from "@/lib/storage"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

const ALLOWED_EXTENSIONS = ["trdx", "pdf", "xml"]

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const templateId = form.get("templateId") as string | null

  if (!file || !templateId) {
    return NextResponse.json({ error: "file and templateId are required" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported` },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `templates/${randomUUID()}-${safeName}`
  const contentType = file.type || "application/octet-stream"
  const fileUrl = await uploadToR2(Buffer.from(bytes), key, contentType)

  const [row] = await db
    .update(coverSheetTemplates)
    .set({ fileUrl, fileName: file.name, updatedAt: new Date() })
    .where(eq(coverSheetTemplates.id, templateId))
    .returning()

  if (!row) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  return NextResponse.json(row)
}
