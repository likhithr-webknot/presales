import { EngagementStage } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export interface CarryForwardContext {
  stage: EngagementStage
  priorArtifacts: Record<string, unknown>
  uploadedDocuments: { fileName: string; uploadType: string; parsedContent: unknown }[]
}

/**
 * Builds the carry-forward context bundle for a given engagement stage.
 * Each stage inherits relevant artifacts from prior stages — AM never re-enters
 * information the system already has.
 *
 * Stage 1→2: research brief + webknot context from Stage 1
 * Stage 2→3: all prior + call notes (MeetMinds)
 * Stage 3→4: approved proposal artifacts
 * Stage 3→5: approved proposal artifacts (SOW input)
 */
export async function buildCarryForwardContext(
  engagementId: string,
  targetStage: EngagementStage
): Promise<CarryForwardContext> {
  // Load all versions — each version's artifacts keyed by stage
  const versions = await prisma.engagementVersion.findMany({
    where: { engagementId },
    orderBy: { version: 'asc' },
  })

  // Load uploads for context
  const uploads = await prisma.engagementUpload.findMany({
    where: { engagementId },
    select: { fileName: true, uploadType: true, parsedContent: true },
  })

  const allArtifacts: Record<string, unknown> = {}
  for (const v of versions) {
    // Merge artifacts from all prior versions (later versions override earlier)
    const artifacts = v.artifacts as Record<string, unknown>
    Object.assign(allArtifacts, artifacts)
  }

  // Filter which artifacts are relevant for the target stage
  const relevantArtifacts = filterArtifactsForStage(allArtifacts, targetStage)

  return {
    stage: targetStage,
    priorArtifacts: relevantArtifacts,
    uploadedDocuments: uploads.map((u) => ({
      fileName: u.fileName,
      uploadType: u.uploadType,
      parsedContent: u.parsedContent,
    })),
  }
}

function filterArtifactsForStage(
  all: Record<string, unknown>,
  stage: EngagementStage
): Record<string, unknown> {
  // Stage 1: no prior artifacts needed — fresh start
  if (stage === EngagementStage.STAGE_1) return {}

  // Stage 2: bring research + context from Stage 1
  if (stage === EngagementStage.STAGE_2) {
    return pick(all, ['researchBrief', 'webknotContext'])
  }

  // Stage 3: all prior + call notes
  if (stage === EngagementStage.STAGE_3) {
    return pick(all, ['researchBrief', 'webknotContext', 'meetMindsOutput', 'caseStudies'])
  }

  // Stage 4 (Defense): approved proposal
  if (stage === EngagementStage.STAGE_4) {
    return pick(all, ['proposal', 'narrativeOutput', 'technicalSolution', 'pricingOutput'])
  }

  // Stage 5 (SOW): approved proposal
  if (stage === EngagementStage.STAGE_5) {
    return pick(all, ['proposal', 'narrativeOutput', 'technicalSolution', 'pricingOutput'])
  }

  return all
}

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))
}
