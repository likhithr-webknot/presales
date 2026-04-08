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
