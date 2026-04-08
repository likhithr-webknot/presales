import {
  IKnowledgeBaseAdapter,
  ProjectRecord,
  CapabilityRecord,
  CaseStudyRecord,
  ProspectContext,
  PositioningOutput,
} from './interface'

export class KnowledgeBaseStubAdapter implements IKnowledgeBaseAdapter {
  async searchProjects(_query: string): Promise<ProjectRecord[]> {
    console.warn('[KnowledgeBaseAdapter:STUB] searchProjects — KB not yet populated, returning empty')
    return []
  }

  async searchCapabilities(_query: string): Promise<CapabilityRecord[]> {
    console.warn('[KnowledgeBaseAdapter:STUB] searchCapabilities — returning placeholder')
    return [
      {
        id: 'stub-cap-1',
        serviceArea: 'AI & Automation',
        capability: 'AI-native product development with Olympus multi-agent orchestration',
        description:
          'Webknot builds AI-first products using the Olympus agent framework — 12 specialist agents covering design, engineering, QA, DevOps, and delivery coordination.',
        frameworks: ['Olympus', 'OpenClaw'],
        differentiators: [
          'Speed: sprint-based AI delivery',
          'Orchestration-native architecture',
          'Full-stack AI capabilities from Day 1',
        ],
      },
    ]
  }

  async searchCaseStudies(_query: string): Promise<CaseStudyRecord[]> {
    console.warn('[KnowledgeBaseAdapter:STUB] searchCaseStudies — KB not yet populated, returning empty')
    return []
  }

  async getPositioning(_context: ProspectContext): Promise<PositioningOutput> {
    console.warn('[KnowledgeBaseAdapter:STUB] getPositioning — returning generic positioning')
    return {
      positioningStatement:
        'Webknot delivers AI-native products at startup speed with enterprise discipline — powered by Olympus, our proprietary multi-agent delivery system.',
      differentiators: [
        'AI-native from Day 1 — not bolted on after',
        'Olympus orchestration reduces delivery time significantly',
        'Full-stack: design → engineering → QA → DevOps under one roof',
      ],
      relevantWedgeOfferings: ['W1', 'W2'],
    }
  }
}
