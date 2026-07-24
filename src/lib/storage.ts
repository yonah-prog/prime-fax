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
  console.log("[storage] downloadFaxFile url:", fileUrl, "| publicUrl:", publicUrl)

  // Our own R2 file — fetch via SDK using credentials
  if (publicUrl && fileUrl.startsWith(publicUrl)) {
    try {
      const key = fileUrl.slice(publicUrl.length + 1)
      console.log("[storage] R2 key:", key)
      const res = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }))
      const chunks: Uint8Array[] = []
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
      const buf = Buffer.concat(chunks)
      console.log("[storage] R2 downloaded bytes:", buf.length)
      return buf
    } catch (e) {
      console.error("[storage] R2 SDK fetch failed, falling back to HTTP:", e)
    }
  }

  // External URL or R2 SDK fallback — fetch directly via HTTP
  try {
    console.log("[storage] HTTP fetch:", fileUrl)
    const res = await fetch(fileUrl)
    if (!res.ok) { console.error("[storage] HTTP fetch failed:", res.status); return null }
    const buf = Buffer.from(await res.arrayBuffer())
    console.log("[storage] HTTP downloaded bytes:", buf.length)
    return buf
  } catch (e) {
    console.error("[storage] HTTP fetch error:", e)
    return null
  }
}
