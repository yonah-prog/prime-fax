import nodemailer from "nodemailer"

function getTransport() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function notifyFaxReceived(fax: {
  fromNumber: string
  toNumber: string
  pages: number | null
  fileUrl: string | null
}): Promise<void> {
  const to = process.env.NOTIFY_EMAIL
  const transport = getTransport()
  if (!to || !transport) return

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  await transport.sendMail({
    from,
    to,
    subject: `New fax received from ${fax.fromNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px">
        <h2 style="color:#1e3a6e">New Fax Received</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 0;color:#666;width:120px">From</td><td style="font-family:monospace">${fax.fromNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#666">To</td><td style="font-family:monospace">${fax.toNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Pages</td><td>${fax.pages ?? "Unknown"}</td></tr>
        </table>
        ${fax.fileUrl ? `<p style="margin-top:16px"><a href="${fax.fileUrl}" style="color:#2563eb">View / Download Fax</a></p>` : ""}
        ${appUrl ? `<p><a href="${appUrl}/inbox" style="color:#2563eb">Open Inbox</a></p>` : ""}
      </div>
    `,
  })
}
