import { CollateralType, FeedbackType, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

/** Records something the AI got wrong. Best-effort: never allowed to break the user's action. */
export async function recordFeedback(params: {
  engagementId: string
  userId?: string
  type: FeedbackType
  collateralType: CollateralType
  payload: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.feedbackEvent.create({
      data: {
        engagementId: params.engagementId,
        userId: params.userId ?? null,
        type: params.type,
        collateralType: params.collateralType,
        payload: params.payload as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[Feedback] could not record event:', err)
  }
}

/** Approved lessons that apply to this collateral type, newest first. Style guidance only. */
export async function approvedLessonTexts(collateralType: CollateralType, limit = 10): Promise<string[]> {
  const rows = await prisma.lesson.findMany({
    where: { status: 'APPROVED', OR: [{ collateralTypes: { isEmpty: true } }, { collateralTypes: { has: collateralType } }] },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { text: true },
  })
  return rows.map((r) => r.text)
}
