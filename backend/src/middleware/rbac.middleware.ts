import { Request, Response, NextFunction } from 'express'
import { RoleType } from '@prisma/client'
import { AuthUser } from './auth.middleware'

export function requireRole(...roles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' })
      return
    }
    const hasRole = roles.some((r) => user.roles.includes(r))
    if (!hasRole) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      })
      return
    }
    next()
  }
}

