import { google } from "googleapis"
import { Readable } from "stream"
import { db } from "./db"
import { users } from "./db/schema"
import { eq, isNotNull } from "drizzle-orm"

/**
 * Build the OAuth redirect URI. Prefer the caller-supplied origin (derived from
 * the actual incoming request), which always matches the domain the user is on
 * and sidesteps NEXT_PUBLIC_APP_URL being unset/wrong/trailing-slashed on the
 * host. Falls back to NEXT_PUBLIC_APP_URL, then localhost, so token refresh
 * (which has no request context) still works.
 */
function buildRedirectUri(origin?: string) {
  const base = (origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
  return `${base}/api/auth/google/callback`
}

function getOAuth2Client(origin?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    buildRedirectUri(origin)
  )
}

// Only the OAuth app credentials are strictly required — the redirect URI is now
// derived per-request, so NEXT_PUBLIC_APP_URL is no longer a hard requirement.
export function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/** The exact redirect URI the OAuth flow uses — register this in Google Cloud Console. */
export function getRedirectUriForDisplay(origin?: string) {
  return buildRedirectUri(origin)
}

export function getAuthUrl(origin?: string) {
  const client = getOAuth2Client(origin)
  const redirectUri = buildRedirectUri(origin)
  // Log the exact redirect URI so a mismatch is diagnosable from server logs —
  // this string must be registered verbatim in Google Cloud Console.
  console.log("Google OAuth redirect_uri:", redirectUri)
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    prompt: "consent",
    redirect_uri: redirectUri,
  })
}

export async function exchangeCode(code: string, origin?: string) {
  const client = getOAuth2Client(origin)
  // The redirect_uri in the token exchange must match the one used to obtain the
  // code, so pass the same derived value.
  const { tokens } = await client.getToken({ code, redirect_uri: buildRedirectUri(origin) })
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
  mimeType = "application/pdf",
  folderOverride?: string | null
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
  // Per-number folder override takes precedence over the user's default folder.
  const folderName = folderOverride?.trim() || user.googleDriveFolder?.trim() || "CareTend Fax"
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
  mimeType = "application/pdf",
  folderOverride?: string | null
): Promise<void> {
  const connected = await db.query.users.findMany({
    where: isNotNull(users.googleRefreshToken),
  })
  await Promise.allSettled(
    connected.map((u) => uploadToDriveForUser(u.id, buf, fileName, mimeType, folderOverride))
  )
}
