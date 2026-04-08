/**
 * Pipeline Advancement Service
 *
 * Called by the /api/internal/job-update route whenever a job completes.
 * Checks if the current pipeline step is fully done (all parallel jobs complete),
 * and if so, dispatches the next step automatically.
 *
 * This is how Research + Context → Packaging auto-wiring works:
 *   1. Both research + context jobs complete (parallel step)
 *   2. This service detects the step is done
 *   3. Dispatches packaging job with both outputs as payload
 */
import { AgentName, EngagementStage, JobStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { dispatchJob } from '../../services/ai-client'
import { wsEvents } from '../../services/websocket/events'
import { writeAuditLog } from '../../services/audit/logger'
import { getPipeline, AgentStep } from './routing'

export async function tryAdvancePipeline(
  completedJobId: string,
  engagementId: string
): Promise<void> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      agentJobs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!engagement || !engagement.collateralType) return

  const pipeline = getPipeline(engagement.collateralType)
  const allJobs = engagement.agentJobs

  // Find which pipeline step the completed job belongs to
  const completedJob = allJobs.find((j) => j.id === completedJobId)
  if (!completedJob) return

  const stepIndex = pipeline.findIndex((step) =>
    step.agents.includes(completedJob.agentName as AgentName)
  )
  if (stepIndex === -1 || stepIndex >= pipeline.length - 1) return // last step or not found

  const currentStep = pipeline[stepIndex]

  // Check if ALL agents in the current parallel step have completed
  const currentStepAgents = currentStep.agents
  const currentStepJobs = allJobs.filter((j) =>
    currentStepAgents.includes(j.agentName as AgentName)
  )

  const allComplete = currentStepJobs.length === currentStepAgents.length &&
    currentStepJobs.every((j) => j.status === JobStatus.COMPLETED)

  if (!allComplete) return // still waiting on parallel jobs

  // B-02 fix: guard against duplicate dispatch (race condition when parallel jobs
  // complete simultaneously — both trigger tryAdvancePipeline within ms of each other)
  const nextStep = pipeline[stepIndex + 1]
  const alreadyDispatched = await prisma.agentJob.findFirst({
    where: {
      engagementId: engagement.id,
      agentName: { in: nextStep.agents as AgentName[] },
      status: { in: [JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.COMPLETED] },
      // Only check jobs created AFTER the current step started (not from prior pipeline runs)
      createdAt: { gte: currentStepJobs[0]?.createdAt ?? new Date(0) },
    },
  })
  if (alreadyDispatched) {
    console.log('[pipeline-advance] Next step already dispatched for', engagement.id, '— skipping duplicate')
    return
  }

  // All parallel jobs in this step are done and no duplicate — dispatch next step
  await dispatchNextStep(nextStep, engagement, currentStepJobs)
}

async function dispatchNextStep(
  step: AgentStep,
  engagement: any,
  completedJobs: any[]
): Promise<void> {
  const engagementId = engagement.id

  // Collect outputs from the completed step to pass as context to next step
  const outputsByAgent: Record<string, unknown> = {}
  for (const job of completedJobs) {
    if (job.output) {
      outputsByAgent[job.agentName] = job.output
    }
  }

  for (const agentName of step.agents) {
    const payload = buildNextStepPayload(
      agentName,
      engagement,
      outputsByAgent
    )

    // Create AgentJob record
    const dbJob = await prisma.agentJob.create({
      data: {
        engagementId,
        agentName: agentName as AgentName,
        status: JobStatus.QUEUED,
        input: payload as Prisma.InputJsonValue,
      },
    })

    // Dispatch to Python AI service
    const jobType = agentToJobType(agentName)
    await dispatchJob(dbJob.id, engagementId, jobType, { ...payload, jobId: dbJob.id })

    wsEvents.jobStarted(engagementId, {
      agentName,
      jobId: dbJob.id,
      jobDbId: dbJob.id,
    })

    await writeAuditLog({
      engagementId,
      userId: 'system',
      action: 'AGENT_INVOKED' as any,
      detail: { agentName, trigger: 'pipeline-advance', jobId: dbJob.id },
    })
  }
}

function buildNextStepPayload(
  agentName: AgentName,
  engagement: any,
  priorOutputs: Record<string, unknown>
): Record<string, unknown> {
  const base = {
    engagement_id: engagement.id,
    client_name: engagement.clientName,
    domain: engagement.domain,
    opportunity_context: engagement.opportunityContext,
  }

  if (agentName === AgentName.PACKAGING_AGENT) {
    return {
      ...base,
      collateral_type: engagement.collateralType,
      stage: stageToNumber(engagement.stage),
      research_brief: priorOutputs[AgentName.SECONDARY_RESEARCH] ?? null,
      webknot_context: priorOutputs[AgentName.CONTEXT_MANAGER] ?? null,
      additional_context: {
        client_name: engagement.clientName,
        domain: engagement.domain,
      },
      output_format: 'pptx',
      version: 1,
    }
  }

  if (agentName === AgentName.CONTEXT_MANAGER) {
    return {
      ...base,
      research_brief: priorOutputs[AgentName.SECONDARY_RESEARCH] ?? null,
    }
  }

  return base
}

function agentToJobType(agentName: AgentName): string {
  const map: Partial<Record<AgentName, string>> = {
    [AgentName.SECONDARY_RESEARCH]: 'research',
    [AgentName.CONTEXT_MANAGER]:    'context',
    [AgentName.PACKAGING_AGENT]:    'packaging',
    [AgentName.CASE_STUDY_MAKER]:   'casestudy',
    [AgentName.SOW_MAKER]:          'sow',
    [AgentName.NARRATIVE_AGENT]:    'narrative',
    [AgentName.TECHNICAL_SOLUTION]: 'technical',
    [AgentName.COMPLIANCE_SCORER]:  'scoring',
    [AgentName.PRICING_ADAPTER]:    'pricing',
  }
  return map[agentName] ?? agentName.toLowerCase()
}

function stageToNumber(stage: EngagementStage): number {
  const map: Record<EngagementStage, number> = {
    STAGE_1: 1, STAGE_2: 2, STAGE_3: 3, STAGE_4: 4, STAGE_5: 5,
  }
  return map[stage]
}
