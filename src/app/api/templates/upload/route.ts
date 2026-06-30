import { auth } from "@/auth"
import { db } from "@/lib/db"
import { coverSheetTemplates } from "@/lib/db/schema"
import { uploadToR2 } from "@/lib/storage"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

// Cover-sheet design files (rendered/used as the page itself).
const DESIGN_EXTENSIONS = ["trdx", "pdf", "xml"]
// Logo images embedded at the top of a generated cover sheet. pdf-lib can only
// embed PNG and JPEG, so those are the supported raster formats.
const LOGO_EXTENSIONS = ["png", "jpg", "jpeg"]

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
  const isLogo = LOGO_EXTENSIONS.includes(ext)
  const isDesign = DESIGN_EXTENSIONS.includes(ext)
  if (!isLogo && !isDesign) {
    return NextResponse.json(
      { error: `Unsupported file. Design: ${DESIGN_EXTENSIONS.join(", ")}. Logo: ${LOGO_EXTENSIONS.join(", ")}.` },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `templates/${randomUUID()}-${safeName}`
  const contentType = file.type || "application/octet-stream"
  const url = await uploadToR2(Buffer.from(bytes), key, contentType)

  // Logo images set logoUrl; design files set fileUrl/fileName.
  const update = isLogo
    ? { logoUrl: url, updatedAt: new Date() }
    : { fileUrl: url, fileName: file.name, updatedAt: new Date() }

  const [row] = await db
    .update(coverSheetTemplates)
    .set(update)
    .where(eq(coverSheetTemplates.id, templateId))
    .returning()

  if (!row) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  return NextResponse.json(row)
}
