import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { RoleType } from '@prisma/client'
import { AuthUser } from './auth.middleware'

export async function requireEngagementAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user as AuthUser | undefined
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // ADMIN sees everything
  if (user.roles.includes(RoleType.ADMIN)) {
    next()
    return
  }

  const engagementId = req.params.id
  if (!engagementId) {
    next()
    return
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { reviewers: true },
  })

  if (!engagement) {
    res.status(404).json({ error: 'Not Found', message: 'Engagement not found' })
    return
  }

  const isCreator = engagement.createdById === user.id
  const isReviewer = engagement.reviewers.some((r) => r.reviewerId === user.id)
  const isSalesHead = user.roles.includes(RoleType.SALES_HEAD)
  const isDM = user.roles.includes(RoleType.DM)

  if (isCreator || isReviewer || isSalesHead || isDM) {
    next()
    return
  }

  res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this engagement' })
}
