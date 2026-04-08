import { Router, Request, Response } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { RoleType } from '@prisma/client'
import { authMiddleware, AuthUser } from '../middleware/auth.middleware'
import { signToken, JWT_EXPIRY_MS } from '../lib/jwt'

export const authRouter = Router()

interface GoogleUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  roleTypes: RoleType[]
}

// Configure Passport Google strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile: Profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        if (!email) return done(new Error('No email in Google profile'))

        // Domain restriction
        if (env.ALLOWED_GOOGLE_DOMAINS) {
          const allowed = env.ALLOWED_GOOGLE_DOMAINS.split(',').map((d) => d.trim())
          const domain = email.split('@')[1]
          if (!allowed.includes(domain)) {
            return done(new Error(`Email domain @${domain} is not allowed`))
          }
        }

        // Upsert user
        const dbUser = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: { email, name: profile.displayName, avatarUrl: profile.photos?.[0]?.value },
          create: {
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
            roles: { create: [{ role: RoleType.AM }] },
          },
          include: { roles: true },
        })

        const googleUser: GoogleUser = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          avatarUrl: dbUser.avatarUrl,
          roleTypes: dbUser.roles.map((r) => r.role),
        }
        return done(null, googleUser as unknown as Express.User)
      } catch (err) {
        return done(err as Error)
      }
    }
  )
)

authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

authRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }),
  (req: Request, res: Response) => {
    const googleUser = req.user as unknown as GoogleUser
    const payload: AuthUser = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      roles: googleUser.roleTypes,
    }
    const token = signToken(payload)
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_EXPIRY_MS, // single source of truth — derived from JWT_EXPIRY env var
    })
    res.redirect(`${env.FRONTEND_URL}/dashboard`)
  }
)

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json(req.user)
})
