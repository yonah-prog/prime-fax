import { google } from "googleapis"
import { Readable } from "stream"

/**
 * Uploads to the shared Google Drive account that patient-messaging-portal uses
 * for signed delivery tickets. That account authorizes with the drive.file scope,
 * so only its own OAuth client can write into folders it created — which is why
 * this uses the portal's client + refresh token (PORTAL_GOOGLE_*), not prime-fax's
 * per-user Google connections.
 */
function getClient() {
  const clientId = process.env.PORTAL_GOOGLE_CLIENT_ID
  const clientSecret = process.env.PORTAL_GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.PORTAL_GOOGLE_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null
  const client = new google.auth.OAuth2(clientId, clientSecret)
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

/** E.g. +17184435000 → 7184435000 (drops the US country code). */
export function faxLineDigits(e164: string) {
  const d = e164.replace(/\D/g, "")
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d
}

/** Fax_<line>_<YYYY-MM-DD_HHMMSS UTC>_<first 8 of fax id>.pdf — matches the backfill. */
export function portalFaxFileName(toNumber: string, receivedAt: Date, faxId: string) {
  const iso = receivedAt.toISOString() // 2026-11-23T15:30:58.123Z
  const stamp = `${iso.slice(0, 10)}_${iso.slice(11, 19).replace(/:/g, "")}`
  return `Fax_${faxLineDigits(toNumber)}_${stamp}_${faxId.slice(0, 8)}.pdf`
}

export async function uploadToPortalDrive(buf: Buffer, fileName: string, folderId: string, mimeType = "application/pdf") {
  const auth = getClient()
  if (!auth) throw new Error("PORTAL_GOOGLE_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN not set")
  const drive = google.drive({ version: "v3", auth })
  await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buf) },
    fields: "id",
    supportsAllDrives: true,
  })
}
