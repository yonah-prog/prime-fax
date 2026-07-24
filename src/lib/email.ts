import sgMail from "@sendgrid/mail"

export async function sendWelcomeEmail(user: {
  name: string
  email: string
  tempPassword: string
}): Promise<void> {
  const key = process.env.SENDGRID_API_KEY
  const from = process.env.SMTP_FROM ?? "Prime Fax <noreply@mailpremierhealth.com>"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  console.log("[email] sendWelcomeEmail called for", user.email, "| key present:", !!key, "| from:", from)

  if (!key) {
    console.error("[email] SENDGRID_API_KEY is not set — skipping welcome email")
    return
  }

  sgMail.setApiKey(key)

  try {
    const res = await sgMail.send({
      to: user.email,
      from,
      subject: "Welcome to Prime Fax — Set Your Password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;color:#1a1a1a">
          <h2 style="color:#1e3a6e">Welcome to Prime Fax, ${user.name}!</h2>
          <p>Your account has been created. Use the temporary credentials below to log in, then change your password right away.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px 0;color:#666;width:140px">Email</td><td style="font-family:monospace">${user.email}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Temp Password</td><td style="font-family:monospace;font-weight:bold">${user.tempPassword}</td></tr>
          </table>
          <p style="margin-top:16px">
            <a href="${appUrl}/login" style="background:#1e3a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
              Log In &amp; Set Password
            </a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:24px">After logging in, go to Settings → Change Password to set a new password.</p>
        </div>
      `,
    })
    console.log("[email] Welcome email sent successfully, status:", res[0]?.statusCode)
  } catch (e: unknown) {
    const err = e as { response?: { body?: unknown }; message?: string }
    console.error("[email] SendGrid error:", JSON.stringify(err?.response?.body ?? err?.message ?? e))
  }
}

export async function notifyFaxReceived(fax: {
  fromNumber: string
  toNumber: string
  pages: number | null
  fileUrl: string | null
  overrideTo?: string
}): Promise<void> {
  const key = process.env.SENDGRID_API_KEY
  const from = process.env.SMTP_FROM ?? "Prime Fax <noreply@mailpremierhealth.com>"
  const to = fax.overrideTo || process.env.NOTIFY_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  if (!key || !to) return

  sgMail.setApiKey(key)

  // Try to fetch and attach the PDF
  let attachment: { content: string; filename: string; type: string; disposition: string } | undefined
  if (fax.fileUrl) {
    try {
      const res = await fetch(fax.fileUrl)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        attachment = {
          content: Buffer.from(buf).toString("base64"),
          filename: `fax-from-${fax.fromNumber.replace(/\D/g, "")}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        }
      }
    } catch {
      // Attachment failed — send without it
    }
  }

  try {
    await sgMail.send({
      to,
      from,
      subject: `New fax received from ${fax.fromNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#1e3a6e">New Fax Received</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 0;color:#666;width:120px">From</td><td style="font-family:monospace">${fax.fromNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#666">To</td><td style="font-family:monospace">${fax.toNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Pages</td><td>${fax.pages ?? "Unknown"}</td></tr>
          </table>
          ${attachment ? "<p style=\"margin-top:12px;color:#555;font-size:13px\">The fax is attached to this email as a PDF.</p>" : ""}
          ${appUrl ? `<p style="margin-top:12px"><a href="${appUrl}/inbox" style="background:#1e3a6e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Open in Prime Fax</a></p>` : ""}
        </div>
      `,
      ...(attachment ? { attachments: [attachment] } : {}),
    })
  } catch (e: unknown) {
    const err = e as { response?: { body?: unknown }; message?: string }
    console.error("[email] notifyFaxReceived error:", JSON.stringify(err?.response?.body ?? err?.message ?? e))
  }
}
