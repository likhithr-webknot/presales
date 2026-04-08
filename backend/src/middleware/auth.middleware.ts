import { Request, Response, NextFunction } from 'express'
import { RoleType } from '@prisma/client'
import { verifyToken } from '../lib/jwt'

export interface AuthUser {
  id: string
  email: string
  name: string
  roles: RoleType[]
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Extend Express.User (used by Passport) to match our AuthUser shape
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No session token' })
    return
  }
  try {
    const decoded = verifyToken<AuthUser>(token)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
  }
}
