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

export async function downloadFromR2(fileUrl: string): Promise<Buffer | null> {
  try {
    const publicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")
    const key = publicUrl && fileUrl.startsWith(publicUrl) ? fileUrl.slice(publicUrl.length + 1) : fileUrl
    console.log("[r2] downloadFromR2 fileUrl:", fileUrl)
    console.log("[r2] publicUrl:", publicUrl)
    console.log("[r2] resolved key:", key)
    console.log("[r2] bucket:", process.env.R2_BUCKET_NAME)
    const res = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }))
    const chunks: Uint8Array[] = []
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const buf = Buffer.concat(chunks)
    console.log("[r2] downloaded bytes:", buf.length)
    return buf
  } catch (e) {
    console.error("[r2] downloadFromR2 failed:", e)
    return null
  }
}
