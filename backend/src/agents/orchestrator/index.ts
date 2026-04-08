import { AgentName, AuditAction, CollateralType, EngagementStage, JobStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { queues } from '../../jobs/queues'
import { wsEvents } from '../../services/websocket/events'
import { writeAuditLog } from '../../services/audit/logger'
import { parseIntake, ParsedIntake } from './intake-parser'
import { detectCollateralType } from './collateral-detector'
import { getPipeline, RESEARCH_DEPTH_BY_STAGE } from './routing'
import { dispatchJob } from '../../services/ai-client'

export interface OrchestratorMessageResult {
  status: 'needs_info' | 'dispatched'
  followUpQuestion?: string
  missingFields?: string[]
  jobIds?: string[]
}

/**
 * Main entry point: AM sends a message to the Orchestrator.
 * 1. Parse intake from message + existing engagement context
 * 2. Detect collateral type if not yet set
 * 3. Check for missing required fields
 * 4. If all fields present: create AgentJob records + dispatch to queues
 * 5. If fields missing: return follow-up question
 */
export async function handleMessage(
  engagementId: string,
  message: string,
  userId: string
): Promise<OrchestratorMessageResult> {
  const engagement = await prisma.engagement.findUniqueOrThrow({
    where: { id: engagementId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })

  // Build existing context from engagement fields
  const existingContext: Partial<ParsedIntake> = {
    clientName: engagement.clientName,
    domain: engagement.domain,
    opportunityContext: engagement.opportunityContext ?? undefined,
    collateralType: engagement.collateralType,
    stage: stageToNumber(engagement.stage),
  }

  // Parse the new message, merging with existing context
  const parsed = await parseIntake(message, existingContext)

  // Update engagement with any newly extracted fields
  await prisma.engagement.update({
    where: { id: engagementId },
    data: {
      clientName: parsed.clientName ?? engagement.clientName,
      domain: parsed.domain ?? engagement.domain,
      opportunityContext: parsed.opportunityContext ?? engagement.opportunityContext,
      contactDetails: (parsed.contactDetails ?? engagement.contactDetails) as Prisma.InputJsonValue | undefined,
    },
  })

  // Still missing required fields — ask follow-up
  if (parsed.missingFields.length > 0) {
    return {
      status: 'needs_info',
      followUpQuestion: parsed.followUpQuestion,
      missingFields: parsed.missingFields,
    }
  }

  // All fields present — detect collateral type if not set
  let collateralType = engagement.collateralType
  if (!collateralType || (parsed.collateralType && parsed.collateralType !== collateralType)) {
    const detected = await detectCollateralType(message)
    collateralType = detected.collateralType
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { collateralType },
    })
  }

  // Dispatch agents
  const jobIds = await dispatchAgents(engagementId, collateralType, engagement.stage, userId, parsed)

  await writeAuditLog({
    engagementId,
    userId,
    action: AuditAction.AGENT_INVOKED,
    detail: { collateralType, stage: engagement.stage, jobCount: jobIds.length },
  })

  return { status: 'dispatched', jobIds }
}

async function dispatchAgents(
  engagementId: string,
  collateralType: CollateralType,
  stage: EngagementStage,
  userId: string,
  context: ParsedIntake
): Promise<string[]> {
  const pipeline = getPipeline(collateralType)
  if (pipeline.length === 0) return []

  // Dispatch only the first step — subsequent steps triggered by job completion handlers
  const firstStep = pipeline[0]
  const jobIds: string[] = []

  for (const agentName of firstStep.agents) {
    const jobInput = buildJobInput(agentName, engagementId, stage, context)

    // Create DB record
    const dbJob = await prisma.agentJob.create({
      data: {
        engagementId,
        agentName,
        status: JobStatus.QUEUED,
        input: jobInput as Prisma.InputJsonValue,
      },
    })

    // Dispatch to Python AI service (primary) with BullMQ as fallback for unimplemented types
    const jobType = agentToJobType(agentName)
    try {
      await dispatchJob(dbJob.id, engagementId, jobType, { ...jobInput, job_id: dbJob.id })
      wsEvents.jobStarted(engagementId, {
        agentName,
        jobId: dbJob.id,
        jobDbId: dbJob.id,
      })
    } catch (err) {
      // AI service unavailable — fall back to BullMQ stub so the engagement doesn't hang
      console.warn(`[Orchestrator] AI service dispatch failed for ${agentName}, falling back to BullMQ stub:`, err)
      const queue = agentToQueue(agentName)
      if (queue) {
        const bullJob = await queue.add(agentName, { ...jobInput, jobId: dbJob.id })
        await prisma.agentJob.update({ where: { id: dbJob.id }, data: { bullmqJobId: bullJob.id ?? null } })
      }
    }

    jobIds.push(dbJob.id)

    await writeAuditLog({
      engagementId,
      userId,
      action: AuditAction.AGENT_INVOKED,
      detail: { agentName, jobDbId: dbJob.id },
    })
  }

  return jobIds
}

function buildJobInput(
  agentName: AgentName,
  engagementId: string,
  stage: EngagementStage,
  context: ParsedIntake
): Record<string, unknown> {
  const base = {
    engagementId,
    clientName: context.clientName,
    domain: context.domain,
    opportunityContext: context.opportunityContext,
  }

  if (agentName === AgentName.SECONDARY_RESEARCH) {
    return { ...base, depth: RESEARCH_DEPTH_BY_STAGE[stage] }
  }

  return base
}

function agentToJobType(agentName: AgentName): string {
  const map: Partial<Record<AgentName, string>> = {
    [AgentName.SECONDARY_RESEARCH]: 'research',
    [AgentName.CONTEXT_MANAGER]:    'context',
    [AgentName.CASE_STUDY_MAKER]:   'casestudy',
    [AgentName.SOW_MAKER]:          'sow',
    [AgentName.NARRATIVE_AGENT]:    'narrative',
    [AgentName.TECHNICAL_SOLUTION]: 'technical',
    [AgentName.PACKAGING_AGENT]:    'packaging',
    [AgentName.PRICING_ADAPTER]:    'pricing',
    [AgentName.COMPLIANCE_SCORER]:  'scoring',
    [AgentName.MEETMINDS_ADAPTER]:  'meetminds',
  }
  return map[agentName] ?? agentName.toLowerCase()
}

function agentToQueue(agentName: AgentName) {
  const map: Partial<Record<AgentName, keyof typeof queues>> = {
    [AgentName.SECONDARY_RESEARCH]: 'research',
    [AgentName.CONTEXT_MANAGER]:    'context',
    [AgentName.CASE_STUDY_MAKER]:   'casestudy',
    [AgentName.SOW_MAKER]:          'sow',
    [AgentName.NARRATIVE_AGENT]:    'narrative',
    [AgentName.TECHNICAL_SOLUTION]: 'technical',
    [AgentName.PACKAGING_AGENT]:    'packaging',
    [AgentName.PRICING_ADAPTER]:    'pricing',
    [AgentName.COMPLIANCE_SCORER]:  'scoring',
    [AgentName.MEETMINDS_ADAPTER]:  'research',
  }
  const queueName = map[agentName]
  return queueName ? queues[queueName] : null
}

function stageToNumber(stage: EngagementStage): number {
  const map: Record<EngagementStage, number> = {
    STAGE_1: 1, STAGE_2: 2, STAGE_3: 3, STAGE_4: 4, STAGE_5: 5,
  }
  return map[stage]
}
