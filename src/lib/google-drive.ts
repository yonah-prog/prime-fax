import { google } from "googleapis"
import { Readable } from "stream"
import { db } from "./db"
import { users } from "./db/schema"
import { eq, isNotNull } from "drizzle-orm"

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  )
}

export function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getAuthUrl() {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    prompt: "consent",
  })
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, folderName: string): Promise<string | null> {
  const safe = folderName.replace(/'/g, "\\'")
  const list = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${safe}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  })
  if ((list.data.files?.length ?? 0) > 0) {
    return list.data.files![0].id ?? null
  }
  const created = await drive.files.create({
    requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  })
  return created.data.id ?? null
}

export async function uploadToDriveForUser(
  userId: string,
  buf: Buffer,
  fileName: string,
  mimeType = "application/pdf"
): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user?.googleRefreshToken) return

  const client = getOAuth2Client()
  client.setCredentials({
    access_token: user.googleAccessToken ?? undefined,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry?.getTime(),
  })

  client.on("tokens", (tokens) => {
    // Fire-and-forget; the emitter does not await this, so swallow errors to
    // avoid an unhandled promise rejection taking down the process.
    db.update(users).set({
      googleAccessToken: tokens.access_token ?? user.googleAccessToken,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : user.googleTokenExpiry,
    }).where(eq(users.id, userId)).catch(() => {})
  })

  const drive = google.drive({ version: "v3", auth: client })
  const folderName = user.googleDriveFolder?.trim() || "CareTend Fax"
  const folderId = await getOrCreateFolder(drive, folderName)

  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : [],
    },
    media: { mimeType, body: Readable.from(buf) },
    fields: "id",
  })
}

export async function uploadToDriveForAll(
  buf: Buffer,
  fileName: string,
  mimeType = "application/pdf"
): Promise<void> {
  const connected = await db.query.users.findMany({
    where: isNotNull(users.googleRefreshToken),
  })
  await Promise.allSettled(
    connected.map((u) => uploadToDriveForUser(u.id, buf, fileName, mimeType))
  )
}
