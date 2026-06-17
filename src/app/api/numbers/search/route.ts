import { auth } from "@/auth"
import { searchAvailableNumbers } from "@/lib/telnyx"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const areaCode = searchParams.get("areaCode")?.replace(/\D/g, "") ?? ""

  if (areaCode.length !== 3) {
    return NextResponse.json({ error: "Provide a 3-digit area code" }, { status: 400 })
  }

  const numbers = await searchAvailableNumbers(areaCode, 10)
  return NextResponse.json(numbers)
}
