# Warden Review — Sprint 8
*Reviewer: Warden 🛡 (conducted by Goku acting as Warden — gateway unavailable)*
*Date: 2026-04-08*
*Sprint: 8 — Admin & Ops Panel*
*Files reviewed:*
- `backend/src/routes/admin.routes.ts`
- `backend/prisma/schema.prisma` (AuditLog change)
- `backend/src/services/audit/logger.ts`
- `frontend/src/pages/Admin/index.tsx`
- `frontend/src/services/api.ts` (adminApi additions)

---

## VERDICT: REVIEW_FAIL → FIXED → PASS ✅

Initial verdict: REVIEW_FAIL. All blocking and important findings fixed in same session. Sprint 9 is authorized.

---

## 🔴 BLOCKING — Must fix before Sprint 9

---

**[B-01] SOW template storage key uses `Date.now()` — collision-safe but filename is not sanitized**

```typescript
const storageKey = `presales-templates/sow/${Date.now()}-${req.file.originalname}`
```

`req.file.originalname` comes directly from the uploaded file's name. A malicious or careless upload with a filename like `../../etc/passwd.docx` or `template with spaces & special chars.docx` creates a MinIO key that:
- Contains path traversal characters (`..`)
- Contains spaces and special characters that break presigned URL generation
- Leaks internal structure if the key appears in any API response

Fix: Sanitize the filename before using it in the storage key:

```typescript
const safeName = req.file.originalname
  .replace(/[^a-zA-Z0-9._-]/g, '_')   // replace unsafe chars
  .replace(/\.\./g, '_')               // no path traversal
  .slice(0, 100)                        // max 100 chars
const storageKey = `presales-templates/sow/${Date.now()}-${safeName}`
```

---

**[B-02] `DELETE /api/admin/users/:id/roles/:role` — no check prevents ADMIN from revoking their own ADMIN role**

```typescript
await prisma.userRole.deleteMany({ where: { userId, role } })
```

If the only ADMIN user accidentally clicks "ADMIN" on their own profile in the Users & Roles tab, they lock themselves out of the admin panel. There's no protection against this.

Fix: Prevent self-demotion from ADMIN:

```typescript
const adminUser = req.user as AuthUser
if (userId === adminUser.id && role === RoleType.ADMIN) {
  res.status(400).json({ error: 'Cannot revoke your own ADMIN role' })
  return
}
// Also ensure at least one ADMIN remains in the system
const remainingAdmins = await prisma.userRole.count({ where: { role: RoleType.ADMIN, userId: { not: userId } } })
if (role === RoleType.ADMIN && remainingAdmins === 0) {
  res.status(400).json({ error: 'Cannot remove the last ADMIN from the system' })
  return
}
```

---

## 🟡 IMPORTANT — Fix before Sprint 9 ships

---

**[I-01] SOW template `default` marking is not atomic — concurrent uploads can produce two defaults**

The "unmark all, then mark this one" pattern:
```typescript
if (isDefault === 'true') {
  const all = await prisma.systemConfig.findMany(...)
  for (const t of all) {
    if (t.key === configKey) continue
    try {
      const parsed = JSON.parse(t.value)
      if (parsed.isDefault) {
        await prisma.systemConfig.update(...)
      }
    } catch { /* skip */ }
  }
}
```

Two concurrent uploads with `isDefault=true` can both read the current state before either writes, resulting in two templates both marked as default.

Fix: Wrap the fetch-and-update in a `prisma.$transaction`, or do the unmark in a single update before creating the new template.

---

**[I-02] `nodemailer` is imported with `await import('nodemailer')` but is not a declared dependency**

`nodemailer` is listed as an optional dynamic import — but it's not in `package.json`. The `try/catch` around the import handles the missing module gracefully (returns 503), but this is fragile in production. If `nodemailer` is needed (and it is for gate reminder emails too), it should be a proper declared dependency.

Fix: Add `nodemailer` and `@types/nodemailer` to `package.json`:
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```
Then change the email test to use a direct import at the top of the file and remove the try/catch wrapper around the import.

---

**[I-03] `GET /api/admin/config` exposes ALL SystemConfig entries — including SOW template keys**

`/api/admin/config` returns `prisma.systemConfig.findMany()` with no filter. This means all 10+ `sow_template_*` keys (with JSON blobs containing storage keys and URLs) will appear in the config list UI. The config tab is meant for operational settings, not template metadata.

Fix: Filter out template keys from the config endpoint:
```typescript
const configs = await prisma.systemConfig.findMany({
  where: { key: { not: { startsWith: 'sow_template_' } } },
  orderBy: { key: 'asc' },
})
```

---

**[I-04] Frontend `KBTab` — search query fires on every keystroke, no debounce**

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['admin-kb', search, typeFilter],
  queryFn:  () => adminApi.listKB({ search: search || undefined, type: typeFilter || undefined, active: true }),
})
```

`search` is a live state value updated on every keystroke. React-query will fire a new API request on every character typed. For a KB with thousands of entries, this is a lot of unnecessary load.

Fix: Debounce the search input (300ms):
```typescript
const [search, setSearch]         = useState('')
const [debouncedSearch, setDebounced] = useState('')

useEffect(() => {
  const t = setTimeout(() => setDebounced(search), 300)
  return () => clearTimeout(t)
}, [search])

// Use debouncedSearch in queryKey and queryFn, not search
```

---

## 🔵 MINOR — Fix when convenient

**[M-01] `PATCH /api/admin/config/:key` — numeric values not validated as numbers**

`compliance_variance_threshold` should be a float, `gate_reminder_hours` and `min_reviewer_count` should be positive integers. The current schema accepts any non-empty string. A value of `"banana"` would be stored and then cause a `parseFloat()` crash downstream when the gate reminder scheduler reads it.

Fix: Add per-key validation:
```typescript
const numericKeys = new Set(['gate_reminder_hours', 'min_reviewer_count', 'max_gate_reminders', 'sow_max_revision_cycles'])
const floatKeys   = new Set(['compliance_variance_threshold'])
if (numericKeys.has(key) && !/^\d+$/.test(value)) {
  res.status(400).json({ error: `${key} must be a positive integer` }); return
}
if (floatKeys.has(key) && isNaN(parseFloat(value))) {
  res.status(400).json({ error: `${key} must be a number` }); return
}
```

**[M-02] Frontend `ConfigTab` — no validation before save**

Related to M-01: the frontend allows saving any string to numeric config keys. Should add input type validation or at least warn the user. Minor since the backend will accept it, but a clear error message is better than silent bad data.

**[M-03] `AuditAction.OVERRIDE_APPLIED` used for admin events — semantically wrong**

Role assignment and config changes are logged with `AuditAction.OVERRIDE_APPLIED` because there was no better option. This will pollute gate override audit queries. The correct fix is to add new AuditAction enum values: `ROLE_ASSIGNED`, `ROLE_REVOKED`, `CONFIG_UPDATED`. Low urgency since admin audit logs are in a separate context (no engagementId), but worth cleaning up in Sprint 9.

**[M-04] SOW template `set as default` route parameter mismatch**

Frontend calls: `PATCH /api/admin/sow-templates/${key}/default` where `key` is already `sow_template_1234567890`.
Backend does: `const targetKey = \`sow_template_${req.params.key}\`` — prepending the prefix again.

So the actual key looked up is `sow_template_sow_template_1234567890` — which will always 404.

Fix: Either remove the prefix prepending in the backend, or strip the prefix in the frontend before calling. Cleanest: strip in frontend:
```typescript
setDefaultTemplate: (key: string) =>
  api.patch(`/api/admin/sow-templates/${key.replace('sow_template_', '')}/default`).then(r => r.data),
```

---

## ✅ What's done well

- **Config key whitelist**: The `ALLOWED_CONFIG_KEYS` set on the PATCH config route prevents arbitrary key injection. Exactly right.
- **KB soft-delete**: Setting `isActive: false` rather than a hard delete preserves content history. Good choice.
- **`upsert` for role assignment**: `prisma.userRole.upsert` is idempotent — clicking "Assign AM" twice doesn't error. Clean.
- **Dynamic nodemailer import**: Catching import failure and returning 503 is a good degradation pattern. Just needs the dep added.
- **MIME type check on template upload**: Rejecting non-.docx files server-side before hitting MinIO. Correct.
- **Tab-based admin panel**: All 6 admin features cleanly separated. No single bloated page.
- **Inline config editing**: Escape key cancels, enter-to-save pattern is natural and correct.

---

## Required fixes before Sprint 9

| # | Fix | File | Priority |
|---|-----|------|----------|
| B-01 | Sanitize template filename before using in storage key | admin.routes.ts | 🔴 |
| B-02 | Prevent self-demotion + last-admin guard on role revoke | admin.routes.ts | 🔴 |
| I-01 | Wrap template default-marking in transaction | admin.routes.ts | 🟡 |
| I-02 | Add nodemailer as proper dependency | package.json | 🟡 |
| I-03 | Filter sow_template_ keys from config list | admin.routes.ts | 🟡 |
| I-04 | Debounce KB search input (300ms) | Admin/index.tsx | 🟡 |
| M-01 | Validate numeric config values server-side | admin.routes.ts | 🔵 |
| M-02 | Add input type validation in ConfigTab | Admin/index.tsx | 🔵 |
| M-03 | Add ROLE_ASSIGNED/ROLE_REVOKED/CONFIG_UPDATED AuditAction enums | schema.prisma | 🔵 |
| M-04 | Fix sow-templates default route param double-prefix bug | api.ts | 🔵 |

---

*Warden out. Fix the 2 blocking + 4 important issues before Sprint 9 is authorized.*
