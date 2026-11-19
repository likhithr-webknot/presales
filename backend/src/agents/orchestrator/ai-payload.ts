import { AgentJob, AgentName, JobStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { approvedLessonTexts } from '../../services/feedback/capture'

/** Evidence the ai-service may cite. Mirrors ai-service grounding.EvidenceKind. */
export interface AiSource {
  kind: 'upload' | 'kb' | 'web' | 'calculation'
  title: string
  text: string
  uri?: string | null
  verified?: boolean
}

interface JobInput {
  engagementId: string
  clientName?: string
  domain?: string
  opportunityContext?: string
  depth?: string
  _runId?: string
  _step?: number
  [key: string]: unknown
}

const MAX_SOURCE_CHARS = 200_000

/** Uploaded documents become evidence. Only real extracted text is passed on. */
export async function uploadSources(engagementId: string): Promise<AiSource[]> {
  const uploads = await prisma.engagementUpload.findMany({ where: { engagementId } })
  const out: AiSource[] = []
  for (const u of uploads) {
    const text = (u.parsedContent as { text?: string } | null)?.text?.trim()
    // The parser emits a placeholder for spreadsheets; never treat placeholders as evidence.
    if (!text || text.startsWith('[Spreadsheet content')) continue
    out.push({ kind: 'upload', title: u.fileName, text: text.slice(0, MAX_SOURCE_CHARS), uri: u.storageKey })
  }
  return out
}

/** Active knowledge-base entries relevant to the domain, plus core capability/differentiator entries. */
export async function knowledgeBaseSources(domain: string | undefined): Promise<AiSource[]> {
  if (env.KB_ADAPTER === 'stub') return [] // stub adapter data is fixture data; never evidence
  const entries = await prisma.knowledgeBaseEntry.findMany({
    where: {
      isActive: true,
      OR: [
        ...(domain ? [{ title: { contains: domain, mode: 'insensitive' as const } }, { content: { contains: domain, mode: 'insensitive' as const } }] : []),
        { type: { in: ['CAPABILITY', 'DIFFERENTIATOR'] as ('CAPABILITY' | 'DIFFERENTIATOR')[] } },
      ],
    },
    take: 20,
    orderBy: { updatedAt: 'desc' },
  })
  return entries.map((e) => ({ kind: 'kb', title: `${e.type}: ${e.title}`, text: e.content, verified: true }))
}

function asSources(output: unknown): AiSource[] {
  const list = (output as { sources?: AiSource[] } | null)?.sources
  return Array.isArray(list) ? list : []
}

/**
 * Builds the payload for an ai-service job: the engagement's own evidence plus the
 * outputs of earlier completed steps in the same pipeline run.
 */
export async function buildAiPayload(job: AgentJob): Promise<Record<string, unknown>> {
  const input = job.input as JobInput
  const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: job.engagementId } })

  const previous = input._runId
    ? await prisma.agentJob.findMany({
        where: {
          engagementId: job.engagementId,
          status: JobStatus.COMPLETED,
          input: { path: ['_runId'], equals: input._runId },
        },
        orderBy: { createdAt: 'asc' },
      })
    : []
  const prior = previous.filter((p) => ((p.input as JobInput)._step ?? 0) < (input._step ?? 0))

  const needsEvidence = job.agentName === AgentName.CONTEXT_MANAGER || job.agentName === AgentName.SECONDARY_RESEARCH
  const own = needsEvidence
    ? [...(await uploadSources(job.engagementId)), ...(await knowledgeBaseSources(engagement.domain))]
    : []

  return {
    ...input,
    collateral_type: engagement.collateralType,
    title: `${engagement.clientName} — ${engagement.collateralType.replace(/_/g, ' ').toLowerCase()}`,
    brief: [engagement.opportunityContext, `Client: ${engagement.clientName}`, `Domain: ${engagement.domain}`]
      .filter(Boolean)
      .join('\n'),
    sources: own,
    lessons: await approvedLessonTexts(engagement.collateralType),
    previous: prior.map((p) => ({ agent_name: p.agentName, output: p.output })),
  }
}

export { asSources }
