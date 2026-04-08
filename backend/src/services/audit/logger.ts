import { AuditAction, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

interface AuditLogParams {
  engagementId?: string   // optional for system-level admin actions
  userId?: string
  action: AuditAction
  detail?: Record<string, unknown>
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        engagementId: params.engagementId,
        userId: params.userId ?? null,
        action: params.action,
        detail: (params.detail ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    // Audit log failure must never crash the main flow — log and continue
    console.error('[AuditLog] Failed to write audit log:', err)
  }
}
