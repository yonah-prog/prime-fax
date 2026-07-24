import sgMail from "@sendgrid/mail"
import { requireAdmin } from "@/lib/require-admin"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const key = process.env.SENDGRID_API_KEY
  const from = process.env.SMTP_FROM ?? "Prime Fax <noreply@mailpremierhealth.com>"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  if (!key) return NextResponse.json({ error: "SENDGRID_API_KEY not set" }, { status: 500 })

  // Generate a minimal test PDF
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText("Prime Fax — Test Notification", { x: 72, y: 700, size: 18, font })
  page.drawText("If you see this PDF attached, email delivery is working correctly.", { x: 72, y: 660, size: 12, font })
  const pdfBytes = await pdf.save()

  sgMail.setApiKey(key)
  try {
    await sgMail.send({
      to: email,
      from,
      subject: "Prime Fax — Test Notification (with PDF)",
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#1e3a6e">Test Fax Notification</h2>
          <p>This is a test email from Prime Fax. A sample PDF is attached.</p>
          ${appUrl ? `<p><a href="${appUrl}/inbox" style="background:#1e3a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Open in Prime Fax</a></p>` : ""}
        </div>
      `,
      attachments: [{
        content: Buffer.from(pdfBytes).toString("base64"),
        filename: "test-fax.pdf",
        type: "application/pdf",
        disposition: "attachment",
      }],
    })
    return NextResponse.json({ ok: true, sentTo: email })
  } catch (e: unknown) {
    const err = e as { response?: { body?: unknown }; message?: string }
    return NextResponse.json({ error: JSON.stringify(err?.response?.body ?? err?.message ?? e) }, { status: 500 })
  }
}
