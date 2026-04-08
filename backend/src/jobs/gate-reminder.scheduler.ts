/**
 * Gate Reminder Scheduler
 * Runs every hour. Finds gates that have been PENDING longer than gate_reminder_hours
 * and fires a reminder WebSocket event + enqueues email job.
 *
 * Register in index.ts: startGateReminderScheduler()
 */
import { GateStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { wsEvents } from '../services/websocket/events'
import { queues } from './queues'

let schedulerInterval: ReturnType<typeof setInterval> | null = null

async function checkPendingGates(): Promise<void> {
  try {
    // Get reminder threshold from SystemConfig (default 24h)
    const cfg = await prisma.systemConfig.findUnique({
      where: { key: 'gate_reminder_hours' },
    })
    const reminderHours = parseInt(cfg?.value ?? '24', 10)
    const cutoff = new Date(Date.now() - reminderHours * 60 * 60 * 1000)

    // M-03 fix: cap at 3 reminders per gate to avoid reminder spam on very stale gates
    const maxReminders = parseInt(
      (await prisma.systemConfig.findUnique({ where: { key: 'max_gate_reminders' } }))?.value ?? '3'
    )

    // Find all gate approvals that are still PENDING and older than threshold
    // but not older than (reminderHours * maxReminders) hours — beyond that, go quiet
    const maxCutoff = new Date(Date.now() - reminderHours * maxReminders * 60 * 60 * 1000)
    const staleGates = await prisma.gateApproval.findMany({
      where: {
        status:    GateStatus.PENDING,
        createdAt: { lt: cutoff, gt: maxCutoff },
      },
      include: {
        engagement: { select: { clientName: true } },
        reviewer:   { select: { name: true, email: true } },
      },
    })

    if (staleGates.length === 0) return

    // Group by engagement + gate
    const grouped = new Map<string, typeof staleGates>()
    for (const gate of staleGates) {
      const key = `${gate.engagementId}:${gate.gateNumber}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(gate)
    }

    for (const [key, gates] of grouped) {
      const [engagementId, gateNumber] = key.split(':')
      const pendingReviewers = gates.map((g) => g.reviewer.name ?? g.reviewer.email)
      const hoursWaiting = Math.floor(
        (Date.now() - gates[0].createdAt.getTime()) / (1000 * 60 * 60)
      )

      // WebSocket reminder event to AM
      wsEvents.gateReminder(engagementId, {
        gateNumber,
        pendingReviewers,
        hoursWaiting,
      })

      // Enqueue email reminder job
      await queues.email.add('gate_reminder', {
        type:             'gate_reminder',
        engagementId,
        gateNumber,
        pendingReviewers,
        hoursWaiting,
        clientName:       gates[0].engagement.clientName,
      })

      console.log(
        `[GateReminder] Sent reminder for ${gateNumber} (${engagementId}) — ${pendingReviewers.length} pending, ${hoursWaiting}h waiting`
      )
    }
  } catch (err) {
    console.error('[GateReminder] Scheduler error:', err)
  }
}

export function startGateReminderScheduler(): void {
  if (schedulerInterval) return // already running

  // Run immediately on startup, then every hour
  checkPendingGates()
  schedulerInterval = setInterval(checkPendingGates, 60 * 60 * 1000)
  console.log('[GateReminder] Scheduler started — checking every 1 hour')
}

export function stopGateReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}
