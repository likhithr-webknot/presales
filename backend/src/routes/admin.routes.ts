/**
 * Admin Routes — ADMIN role required on all endpoints.
 *
 * User Management:
 *   GET    /api/admin/users                    — list all users + roles
 *   POST   /api/admin/users/:id/roles          — assign role
 *   DELETE /api/admin/users/:id/roles/:role    — revoke role
 *
 * Knowledge Base:
 *   GET    /api/admin/kb                       — list entries (paginated + filtered)
 *   POST   /api/admin/kb                       — create entry
 *   PATCH  /api/admin/kb/:id                   — update entry
 *   DELETE /api/admin/kb/:id                   — deactivate entry (soft delete)
 *
 * System Config:
 *   GET    /api/admin/config                   — list all config keys
 *   PATCH  /api/admin/config/:key              — update a config value
 *
 * Email:
 *   POST   /api/admin/email/test               — send test email to self
 *
 * SOW Templates:
 *   GET    /api/admin/sow-templates            — list uploaded templates
 *   POST   /api/admin/sow-templates            — upload new template (multipart)
 *   PATCH  /api/admin/sow-templates/:id/default — mark as default
 */
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuditAction, KBEntryType, Prisma, RoleType } from '@prisma/client'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authMiddleware, AuthUser } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { writeAuditLog } from '../services/audit/logger'
import { presignedUrl, putObject } from '../services/storage/service'
import { env } from '../config/env'

export const adminRouter = Router()

// All admin routes require auth + ADMIN role
adminRouter.use(authMiddleware)
adminRouter.use(requireRole(RoleType.ADMIN))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ── User Management ───────────────────────────────────────────────────────────

adminRouter.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      include: { roles: true },
      orderBy: { name: 'asc' },
    })
    res.json(users.map(u => ({
      id:        u.id,
      email:     u.email,
      name:      u.name,
      avatarUrl: u.avatarUrl,
      roles:     u.roles.map(r => r.role),
      createdAt: u.createdAt,
    })))
  } catch (err) { next(err) }
})

adminRouter.post(
  '/users/:id/roles',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = z.object({ role: z.nativeEnum(RoleType) }).parse(req.body)
      const userId = req.params.id

      await prisma.userRole.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role },
        update: {},
      })

      await writeAuditLog({
        // no engagementId — system-level action
        userId: (req.user as AuthUser).id,
        action: AuditAction.OVERRIDE_APPLIED,
        detail: { event: 'role_assigned', targetUserId: userId, role },
      })

      res.json({ message: `Role ${role} assigned to user ${userId}` })
    } catch (err) { next(err) }
  }
)

adminRouter.delete(
  '/users/:id/roles/:role',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.params.role as RoleType
      if (!Object.values(RoleType).includes(role)) {
        res.status(400).json({ error: 'Invalid role' })
        return
      }
      const userId = req.params.id

      await prisma.userRole.deleteMany({ where: { userId, role } })

      await writeAuditLog({
        // no engagementId — system-level action
        userId: (req.user as AuthUser).id,
        action: AuditAction.OVERRIDE_APPLIED,
        detail: { event: 'role_revoked', targetUserId: userId, role },
      })

      res.json({ message: `Role ${role} revoked from user ${userId}` })
    } catch (err) { next(err) }
  }
)

// ── Knowledge Base ────────────────────────────────────────────────────────────

const kbQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  type:   z.nativeEnum(KBEntryType).optional(),
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
})

adminRouter.get('/kb', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = kbQuerySchema.parse(req.query)
    const skip = (q.page - 1) * q.limit

    const where = {
      ...(q.type   ? { type: q.type }                          : {}),
      ...(q.active !== undefined ? { isActive: q.active === 'true' } : {}),
      ...(q.search ? {
        OR: [
          { title:   { contains: q.search, mode: 'insensitive' as const } },
          { content: { contains: q.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [entries, total] = await Promise.all([
      prisma.knowledgeBaseEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.knowledgeBaseEntry.count({ where }),
    ])

    res.json({
      data: entries,
      pagination: {
        page: q.page, limit: q.limit, total,
        totalPages: Math.ceil(total / q.limit),
        hasNext: q.page * q.limit < total,
      },
    })
  } catch (err) { next(err) }
})

const kbCreateSchema = z.object({
  type:     z.nativeEnum(KBEntryType),
  title:    z.string().min(1).max(200),
  content:  z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
})

adminRouter.post('/kb', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = kbCreateSchema.parse(req.body)
    const entry = await prisma.knowledgeBaseEntry.create({
      data: { ...body, metadata: body.metadata as Prisma.InputJsonValue, isActive: true },
    })
    res.status(201).json(entry)
  } catch (err) { next(err) }
})

const kbUpdateSchema = z.object({
  title:    z.string().min(1).max(200).optional(),
  content:  z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

adminRouter.patch('/kb/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = kbUpdateSchema.parse(req.body)
    const entry = await prisma.knowledgeBaseEntry.update({
      where: { id: req.params.id },
      data: {
        title:    body.title,
        content:  body.content,
        isActive: body.isActive,
        ...(body.metadata !== undefined ? { metadata: body.metadata as Prisma.InputJsonValue } : {}),
      },
    })
    res.json(entry)
  } catch (err) { next(err) }
})

adminRouter.delete('/kb/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Soft delete — set isActive = false, preserve content for audit history
    await prisma.knowledgeBaseEntry.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    res.json({ message: 'Entry deactivated' })
  } catch (err) { next(err) }
})

// ── System Config ─────────────────────────────────────────────────────────────

// Allowed config keys — whitelist prevents arbitrary key injection
const ALLOWED_CONFIG_KEYS = new Set([
  'gate_reminder_hours',
  'min_reviewer_count',
  'compliance_variance_threshold',
  'max_gate_reminders',
  'sow_max_revision_cycles',
])

adminRouter.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } })
    res.json(configs)
  } catch (err) { next(err) }
})

adminRouter.patch('/config/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      res.status(400).json({ error: 'Unknown config key', allowedKeys: [...ALLOWED_CONFIG_KEYS] })
      return
    }

    const { value } = z.object({ value: z.string().min(1) }).parse(req.body)

    const config = await prisma.systemConfig.upsert({
      where:  { key },
      create: { key, value },
      update: { value },
    })

    await writeAuditLog({
      // no engagementId — system-level action
      userId: (req.user as AuthUser).id,
      action: AuditAction.OVERRIDE_APPLIED,
      detail: { event: 'config_updated', key, value },
    })

    res.json(config)
  } catch (err) { next(err) }
})

// ── Email Test ────────────────────────────────────────────────────────────────

adminRouter.post('/email/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as AuthUser

    // Dynamic import — nodemailer optional dependency, may not be installed in all envs
    let transporter: any
    try {
      const nodemailer = await import('nodemailer')
      transporter = nodemailer.createTransport({
        host:   env.EMAIL_SMTP_HOST,
        port:   env.EMAIL_SMTP_PORT,
        secure: env.EMAIL_SMTP_PORT === 465,
        auth: {
          user: env.EMAIL_SMTP_USER,
          pass: env.EMAIL_SMTP_PASS,
        },
      })
    } catch {
      res.status(503).json({ error: 'SMTP not configured', message: 'nodemailer is not installed or SMTP env vars are missing' })
      return
    }

    await transporter.sendMail({
      from:    env.EMAIL_SMTP_USER,
      to:      user.email,
      subject: 'Presales Orchestrator — SMTP Test',
      text:    `SMTP configuration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
    })

    res.json({ message: `Test email sent to ${user.email}` })
  } catch (err) { next(err) }
})

// ── SOW Template Management ───────────────────────────────────────────────────

adminRouter.get('/sow-templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Templates stored as SystemConfig keys prefixed with `sow_template_`
    const templates = await prisma.systemConfig.findMany({
      where: { key: { startsWith: 'sow_template_' } },
      orderBy: { key: 'asc' },
    })

    // Parse template metadata from stored JSON values
    const parsed = templates.map(t => {
      try {
        return { key: t.key, ...JSON.parse(t.value) }
      } catch {
        return { key: t.key, value: t.value }
      }
    })

    res.json(parsed)
  } catch (err) { next(err) }
})

adminRouter.post(
  '/sow-templates',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' })
        return
      }

      const { name, isDefault } = z.object({
        name:      z.string().min(1),
        isDefault: z.enum(['true', 'false']).optional().default('false'),
      }).parse(req.body)

      const mimeType = req.file.mimetype
      if (!['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'].includes(mimeType)) {
        res.status(400).json({ error: 'Invalid file type. Only .docx files are accepted.' })
        return
      }

      const storageKey = `presales-templates/sow/${Date.now()}-${req.file.originalname}`
      await putObject('presales-artifacts', storageKey, req.file.buffer, mimeType)

      const templateUrl = await presignedUrl('presales-artifacts', storageKey, 24 * 365) // 1 year TTL

      const configKey = `sow_template_${Date.now()}`
      await prisma.systemConfig.create({
        data: {
          key:   configKey,
          value: JSON.stringify({ name, storageKey, url: templateUrl, isDefault: isDefault === 'true', uploadedAt: new Date().toISOString() }),
        },
      })

      // If marking as default, unmark all others
      if (isDefault === 'true') {
        const all = await prisma.systemConfig.findMany({ where: { key: { startsWith: 'sow_template_' } } })
        for (const t of all) {
          if (t.key === configKey) continue
          try {
            const parsed = JSON.parse(t.value)
            if (parsed.isDefault) {
              await prisma.systemConfig.update({
                where: { key: t.key },
                data:  { value: JSON.stringify({ ...parsed, isDefault: false }) },
              })
            }
          } catch { /* malformed entry — skip */ }
        }
      }

      res.status(201).json({ message: 'Template uploaded', key: configKey, name, storageKey })
    } catch (err) { next(err) }
  }
)

adminRouter.patch('/sow-templates/:key/default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetKey = `sow_template_${req.params.key}`

    const target = await prisma.systemConfig.findUnique({ where: { key: targetKey } })
    if (!target) { res.status(404).json({ error: 'Template not found' }); return }

    // Unmark all, then mark this one
    const all = await prisma.systemConfig.findMany({ where: { key: { startsWith: 'sow_template_' } } })
    await Promise.all(all.map(async t => {
      try {
        const parsed = JSON.parse(t.value)
        await prisma.systemConfig.update({
          where: { key: t.key },
          data:  { value: JSON.stringify({ ...parsed, isDefault: t.key === targetKey }) },
        })
      } catch { /* malformed — skip */ }
    }))

    res.json({ message: `Template ${targetKey} set as default` })
  } catch (err) { next(err) }
})
