export interface ProjectRecord {
  id: string
  clientName: string
  domain: string
  techStack: string[]
  teamSize: number
  durationMonths: number
  outcomes: { metric: string; value: string }[]
  summary: string
  isAnonymized: boolean
}

export interface CapabilityRecord {
  id: string
  serviceArea: string
  capability: string
  description: string
  frameworks: string[]
  differentiators: string[]
}

export interface CaseStudyRecord {
  id: string
  projectId: string
  domain: string
  capability: string
  baseContent: string
  outcomes: { metric: string; before: string; after: string }[]
  isAnonymized: boolean
}

export interface ProspectContext {
  domain: string
  opportunityType: string
  requiredCapabilities: string[]
  framingAngle?: string
}

export interface PositioningOutput {
  positioningStatement: string
  differentiators: string[]
  relevantWedgeOfferings: string[]
}

export interface IKnowledgeBaseAdapter {
  searchProjects(
    query: string,
    filters?: { domain?: string; techStack?: string[]; minOutcomeScore?: number }
  ): Promise<ProjectRecord[]>

  searchCapabilities(
    query: string,
    filters?: { serviceArea?: string }
  ): Promise<CapabilityRecord[]>

  searchCaseStudies(
    query: string,
    filters?: { domain?: string; capability?: string }
  ): Promise<CaseStudyRecord[]>

  getPositioning(context: ProspectContext): Promise<PositioningOutput>
}
