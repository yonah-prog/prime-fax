import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"

interface AuditParams {
  userId?: string | null
  userEmail?: string | null
  action: string
  resourceType?: string
  resourceId?: string
  meta?: Record<string, unknown>
}

export async function audit(params: AuditParams) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      action: params.action,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      meta: params.meta ? JSON.stringify(params.meta) : null,
    })
  } catch {
    // Audit failure must never break the main operation
  }
}
