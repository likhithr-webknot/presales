import { AuditAction, CollateralType, EngagementStage, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { writeAuditLog } from '../../services/audit/logger'
import { parseIntake, ParsedIntake } from './intake-parser'
import { detectCollateralType } from './collateral-detector'
import { getPipeline } from './routing'
import { dispatchStep, newRunId } from './pipeline'

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
  if (getPipeline(collateralType).length === 0) return []
  // Only step 0 here; applyJobUpdate() dispatches each later step when the previous one settles.
  return dispatchStep(
    engagementId, collateralType, stage, userId,
    { clientName: context.clientName, domain: context.domain, opportunityContext: context.opportunityContext },
    0, newRunId()
  )
}

function stageToNumber(stage: EngagementStage): number {
  const map: Record<EngagementStage, number> = {
    STAGE_1: 1, STAGE_2: 2, STAGE_3: 3, STAGE_4: 4, STAGE_5: 5,
  }
  return map[stage]
}
