import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )

  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function downloadFaxFile(fileUrl: string): Promise<Buffer | null> {
  const publicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")

  // Our own R2 file — fetch via SDK using credentials
  if (publicUrl && fileUrl.startsWith(publicUrl)) {
    try {
      const key = fileUrl.slice(publicUrl.length + 1)
      const res = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }))
      const chunks: Uint8Array[] = []
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
      return Buffer.concat(chunks)
    } catch (e) {
      console.error("[storage] R2 download failed:", e)
      return null
    }
  }

  // External URL (Telnyx presigned, HumbleFax S3, etc.) — fetch directly via HTTP
  try {
    const res = await fetch(fileUrl)
    if (!res.ok) { console.error("[storage] HTTP fetch failed:", res.status, fileUrl); return null }
    return Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.error("[storage] HTTP fetch error:", e)
    return null
  }
}
