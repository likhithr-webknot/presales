import { sign, verify, SignOptions } from 'jsonwebtoken'
import { env } from '../config/env'

/**
 * Parse a JWT expiry string like '7d', '1h', '30m' into milliseconds.
 * Used to keep cookie maxAge in sync with JWT expiry.
 */
function expiryToMs(expiry: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }
  const match = expiry.match(/^(\d+)([smhdw])$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000 // fallback: 7d
  return parseInt(match[1], 10) * (units[match[2]] ?? units['d'])
}

export const JWT_EXPIRY_MS = expiryToMs(env.JWT_EXPIRY)

export function signToken(payload: object): string {
  const opts: SignOptions = {
    expiresIn: env.JWT_EXPIRY as SignOptions['expiresIn'],
  }
  return sign(payload, env.JWT_SECRET, opts)
}

export function verifyToken<T>(token: string): T {
  return verify(token, env.JWT_SECRET) as T
}
