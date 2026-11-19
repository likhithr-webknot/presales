import { AgentName, CollateralType, EngagementStage } from '@prisma/client'

export interface AgentStep {
  agents: AgentName[]
  parallel: boolean
}

export type AgentPipeline = AgentStep[]

// Maps collateral type → ordered pipeline of agent steps
// parallel: true = all agents in this step run concurrently
// parallel: false = this agent runs after previous step completes
const PIPELINES: Record<CollateralType, AgentPipeline> = {
  [CollateralType.FIRST_MEETING_DECK]: [
    { agents: [AgentName.SECONDARY_RESEARCH, AgentName.CONTEXT_MANAGER], parallel: true },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.POST_DISCOVERY_DECK]: [
    { agents: [AgentName.MEETMINDS_ADAPTER], parallel: false },
    { agents: [AgentName.SECONDARY_RESEARCH, AgentName.CONTEXT_MANAGER, AgentName.CASE_STUDY_MAKER], parallel: true },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.TECHNICAL_PROPOSAL]: [
    { agents: [AgentName.MEETMINDS_ADAPTER], parallel: false },
    { agents: [AgentName.SECONDARY_RESEARCH, AgentName.CONTEXT_MANAGER], parallel: true },
    { agents: [AgentName.NARRATIVE_AGENT], parallel: false }, // Gate 1
    { agents: [AgentName.TECHNICAL_SOLUTION, AgentName.CASE_STUDY_MAKER], parallel: true }, // Gate 2
    { agents: [AgentName.PRICING_ADAPTER], parallel: false }, // Gate 3
    { agents: [AgentName.NARRATIVE_AGENT], parallel: false }, // coherence pass
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.PROPOSAL_DEFENSE_DECK]: [
    { agents: [AgentName.CONTEXT_MANAGER], parallel: false },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.STATEMENT_OF_WORK]: [
    { agents: [AgentName.SOW_MAKER], parallel: false },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.COMMERCIAL_ESTIMATION]: [
    { agents: [AgentName.TECHNICAL_SOLUTION], parallel: false },
    { agents: [AgentName.PRICING_ADAPTER], parallel: false },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.CASE_STUDY_DOCUMENT]: [
    { agents: [AgentName.CASE_STUDY_MAKER], parallel: false },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
  [CollateralType.MARKETING_CONTENT]: [
    { agents: [AgentName.CONTEXT_MANAGER], parallel: false },
    { agents: [AgentName.PACKAGING_AGENT], parallel: false },
  ],
}

// Stage depth scaling for research
export const RESEARCH_DEPTH_BY_STAGE: Record<EngagementStage, 'light' | 'medium' | 'deep'> = {
  [EngagementStage.STAGE_1]: 'light',
  [EngagementStage.STAGE_2]: 'medium',
  [EngagementStage.STAGE_3]: 'deep',
  [EngagementStage.STAGE_4]: 'medium',
  [EngagementStage.STAGE_5]: 'light',
}

export function getPipeline(collateralType: CollateralType): AgentPipeline {
  return PIPELINES[collateralType] ?? PIPELINES[CollateralType.FIRST_MEETING_DECK]
}

export function getFirstStep(collateralType: CollateralType): AgentStep {
  return getPipeline(collateralType)[0]
}

// Agent → BullMQ queue. The queue name is also the ai-service job type.
const AGENT_QUEUE: Partial<Record<AgentName, string>> = {
  [AgentName.SECONDARY_RESEARCH]: 'research',
  [AgentName.CONTEXT_MANAGER]:    'context',
  [AgentName.CASE_STUDY_MAKER]:   'casestudy',
  [AgentName.SOW_MAKER]:          'sow',
  [AgentName.NARRATIVE_AGENT]:    'narrative',
  [AgentName.TECHNICAL_SOLUTION]: 'technical',
  [AgentName.PACKAGING_AGENT]:    'packaging',
  [AgentName.PRICING_ADAPTER]:    'pricing',
  [AgentName.COMPLIANCE_SCORER]:  'scoring',
  [AgentName.MEETMINDS_ADAPTER]:  'research', // MeetMinds uses the research queue slot
}

export function queueForAgent(agentName: AgentName): string | null {
  return AGENT_QUEUE[agentName] ?? null
}

export type StepDecision =
  | { action: 'wait' }
  | { action: 'next'; step: number }
  | { action: 'done' }
  | { action: 'failed'; error: string }

/**
 * Pure planner: given the statuses of every job in the run, decide what happens next.
 * Kept free of I/O so the pipeline rules can be unit-tested.
 */
export function planNextStep(
  stepCount: number,
  jobs: { step: number; status: string; error?: string | null }[]
): StepDecision {
  const failed = jobs.find((j) => j.status === 'FAILED')
  if (failed) return { action: 'failed', error: failed.error ?? 'Agent failed' }
  if (jobs.some((j) => j.status === 'CANCELLED')) return { action: 'wait' }
  if (jobs.length === 0) return { action: 'wait' }

  const current = Math.max(...jobs.map((j) => j.step))
  const inStep = jobs.filter((j) => j.step === current)
  if (!inStep.every((j) => j.status === 'COMPLETED')) return { action: 'wait' }
  return current + 1 >= stepCount ? { action: 'done' } : { action: 'next', step: current + 1 }
}
