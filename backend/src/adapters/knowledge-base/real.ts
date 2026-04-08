import {
  IKnowledgeBaseAdapter,
  ProjectRecord,
  CapabilityRecord,
  CaseStudyRecord,
  ProspectContext,
  PositioningOutput,
} from './interface'

/**
 * Real Knowledge Base adapter using pgvector semantic search.
 * TODO: Implement when Webknot Knowledge Base content exists and is populated.
 * Set KB_ADAPTER=real to activate.
 *
 * Implementation notes (for Sprint 9):
 * - Uses prisma.$queryRaw for vector similarity search
 * - Embeddings generated via OpenAI text-embedding-3-small (1536 dims)
 * - See migration 0001_initial.sql for the embedding column + IVFFlat index
 */
export class KnowledgeBaseRealAdapter implements IKnowledgeBaseAdapter {
  async searchProjects(_query: string): Promise<ProjectRecord[]> {
    throw new Error(
      'NotImplementedError: Replace KnowledgeBaseRealAdapter with pgvector implementation when Webknot Knowledge Base content is populated. See Sprint 9 tasks.'
    )
  }

  async searchCapabilities(_query: string): Promise<CapabilityRecord[]> {
    throw new Error('NotImplementedError: Knowledge Base not yet implemented.')
  }

  async searchCaseStudies(_query: string): Promise<CaseStudyRecord[]> {
    throw new Error('NotImplementedError: Knowledge Base not yet implemented.')
  }

  async getPositioning(_context: ProspectContext): Promise<PositioningOutput> {
    throw new Error('NotImplementedError: Knowledge Base not yet implemented.')
  }
}
