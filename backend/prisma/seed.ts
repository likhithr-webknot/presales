import { PrismaClient, RoleType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // System config defaults
  const configs = [
    { key: 'gate_reminder_hours', value: '24' },
    { key: 'min_reviewer_count', value: '1' },
    { key: 'compliance_variance_threshold', value: '1.0' },
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    })
  }
  console.log('✅ SystemConfig seeded')

  // Seed admin user (replace with real Google ID after first login)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@webknot.in' },
    update: {},
    create: {
      email: 'admin@webknot.in',
      name: 'Admin',
      googleId: 'seed-admin-google-id',
      roles: {
        create: [{ role: RoleType.ADMIN }, { role: RoleType.AM }],
      },
    },
  })
  console.log(`✅ Admin user seeded: ${admin.email}`)

  console.log('🌱 Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
