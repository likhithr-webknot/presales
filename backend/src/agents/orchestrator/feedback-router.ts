/**
 * Feedback Router
 * Routes AM feedback to the correct agent for revision.
 * Uses keyword matching + a lightweight LLM call for ambiguous cases.
 */
import { AgentName, EngagementStage, JobStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { dispatchJob } from '../../services/ai-client'
import { wsEvents } from '../../services/websocket/events'
import { writeAuditLog } from '../../services/audit/logger'
// createNewVersion imported when needed in Sprint 5

export interface FeedbackResult {
  routedTo: string
  jobId: string
  message: string
}

// Rule-based routing — no LLM needed for obvious cases
function routeByKeyword(feedback: string, _stage: EngagementStage): AgentName | null {
  const f = feedback.toLowerCase()

  if (/case study|case-study|reference|example project/i.test(f)) return AgentName.CASE_STUDY_MAKER
  if (/tone|voice|language|writing|narrative|story|positioning/i.test(f)) return AgentName.NARRATIVE_AGENT
  if (/technical|architecture|tech stack|infrastructure|security|scalability/i.test(f)) return AgentName.TECHNICAL_SOLUTION
  if (/pricing|cost|budget|estimate|bom|bill of material/i.test(f)) return AgentName.PRICING_ADAPTER
  if (/slide|deck|format|layout|design|pptx|powerpoint/i.test(f)) return AgentName.PACKAGING_AGENT
  if (/research|market|industry|competitor|news/i.test(f)) return AgentName.SECONDARY_RESEARCH
  if (/sow|scope|deliverable|milestone|payment/i.test(f)) return AgentName.SOW_MAKER

  return null // falls through to LLM routing (Sprint 5)
}

function agentToJobType(agent: AgentName): string {
  const map: Partial<Record<AgentName, string>> = {
    [AgentName.CASE_STUDY_MAKER]:   'casestudy',
    [AgentName.NARRATIVE_AGENT]:    'narrative',
    [AgentName.TECHNICAL_SOLUTION]: 'technical',
    [AgentName.PRICING_ADAPTER]:    'pricing',
    [AgentName.PACKAGING_AGENT]:    'packaging',
    [AgentName.SECONDARY_RESEARCH]: 'research',
    [AgentName.SOW_MAKER]:          'sow',
  }
  return map[agent] ?? 'packaging'
}

export async function routeFeedback(
  engagementId: string,
  userId: string,
  feedback: string,
  targetSection?: string
): Promise<FeedbackResult> {
  const engagement = await prisma.engagement.findUniqueOrThrow({
    where: { id: engagementId },
    include: {
      versions: { where: { isLatest: true }, take: 1 },
      agentJobs: { where: { status: JobStatus.COMPLETED }, orderBy: { completedAt: 'desc' } },
    },
  })

  // Route feedback to agent
  const targetAgent = targetSection
    ? _sectionToAgent(targetSection)
    : routeByKeyword(feedback, engagement.stage)

  const routedAgent = targetAgent ?? AgentName.PACKAGING_AGENT // safe fallback

  // Build payload from latest completed jobs' outputs
  const jobOutputs: Record<string, unknown> = {}
  for (const job of engagement.agentJobs) {
    if (job.output) {
      jobOutputs[job.agentName] = job.output
    }
  }

  const jobPayload: Record<string, unknown> = {
    engagement_id:        engagementId,
    client_name:          engagement.clientName,
    domain:               engagement.domain,
    opportunity_context:  engagement.opportunityContext,
    am_instructions:      feedback,
    research_brief:       jobOutputs[AgentName.SECONDARY_RESEARCH],
    webknot_context:      jobOutputs[AgentName.CONTEXT_MANAGER],
    prior_narrative:      jobOutputs[AgentName.NARRATIVE_AGENT],
    technical_solution:   jobOutputs[AgentName.TECHNICAL_SOLUTION],
  }

  // Create new AgentJob
  const dbJob = await prisma.agentJob.create({
    data: {
      engagementId,
      agentName: routedAgent,
      status: JobStatus.QUEUED,
      input: { feedback, targetSection } as Prisma.InputJsonValue,
    },
  })

  await dispatchJob(dbJob.id, engagementId, agentToJobType(routedAgent), {
    ...jobPayload,
    job_id: dbJob.id,
  })

  wsEvents.jobStarted(engagementId, {
    agentName: routedAgent,
    jobId: dbJob.id,
    jobDbId: dbJob.id,
  })

  await writeAuditLog({
    engagementId,
    userId,
    action: 'AGENT_INVOKED' as any,
    detail: { trigger: 'feedback', feedback: feedback.slice(0, 200), routedTo: routedAgent },
  })

  return {
    routedTo: routedAgent,
    jobId:    dbJob.id,
    message:  `Feedback routed to ${routedAgent}. Revision in progress.`,
  }
}

function _sectionToAgent(section: string): AgentName | null {
  const s = section.toLowerCase()
  if (s.includes('case')) return AgentName.CASE_STUDY_MAKER
  if (s.includes('technical') || s.includes('architecture')) return AgentName.TECHNICAL_SOLUTION
  if (s.includes('pricing') || s.includes('cost')) return AgentName.PRICING_ADAPTER
  if (s.includes('narrative') || s.includes('positioning')) return AgentName.NARRATIVE_AGENT
  return AgentName.PACKAGING_AGENT
}
