/**
 * AI Service HTTP Client
 * Thin wrapper around fetch calls to the Python ai-service.
 * All LLM logic lives in ai-service — this is just the bridge.
 */
import { env } from '../config/env'

export class AIServiceError extends Error {
  constructor(
    public endpoint: string,
    public status: number,
    public body: string
  ) {
    super(`AI service error [${status}] on ${endpoint}: ${body.slice(0, 200)}`)
    this.name = 'AIServiceError'
  }
}

export class AIServiceUnavailableError extends Error {
  constructor(public endpoint: string, public cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause)
    super(`AI service unreachable at ${endpoint}: ${msg}`)
    this.name = 'AIServiceUnavailableError'
  }
}

// ── Shared request helper ─────────────────────────────────────────────────────

async function callAIService<T>(
  path: string,
  body: unknown,
  timeoutMs = 30_000
): Promise<T> {
  const url = `${env.AI_SERVICE_URL}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-internal-secret': env.AI_INTERNAL_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AIServiceError(path, res.status, text)
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof AIServiceError) throw err
    throw new AIServiceUnavailableError(path, err)
  } finally {
    clearTimeout(timer)
  }
}

// ── Typed response shapes (mirrors Python Pydantic schemas) ───────────────────

export interface ParsedFields {
  client_name?: string | null
  domain?: string | null
  opportunity_context?: string | null
  contact_details?: { name?: string; email?: string; role?: string } | null
  collateral_type?: string | null
  stage?: number | null
}

export interface IntakeParseResponse {
  parsed: ParsedFields
  missing_fields: string[]
  follow_up_question?: string | null
  raw_message: string
}

export interface CollateralDetectResponse {
  collateral_type: string
  confidence: 'rule' | 'llm'
}

export interface JobDispatchResponse {
  accepted: boolean
  job_id: string
  message: string
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an AM's freeform message into structured intake fields.
 * Synchronous — waits for Python to return before proceeding.
 */
export async function parseIntake(
  message: string,
  existingContext?: Partial<ParsedFields>,
  engagementId?: string
): Promise<IntakeParseResponse> {
  return callAIService<IntakeParseResponse>('/intake/parse', {
    message,
    existing_context: existingContext ?? null,
    engagement_id: engagementId ?? null,
  })
}

/**
 * Detect which type of collateral the AM is asking for.
 * Synchronous — used in the /message route before agent dispatch.
 */
export async function detectCollateral(
  message: string,
  engagementId?: string
): Promise<CollateralDetectResponse> {
  return callAIService<CollateralDetectResponse>('/collateral/detect', {
    message,
    engagement_id: engagementId ?? null,
  })
}

/**
 * Dispatch an agent job to the Python AI service.
 * Async — returns 202 immediately; Python calls back via /api/internal/job-update.
 */
export async function dispatchJob(
  jobId: string,
  engagementId: string,
  jobType: string,
  payload: Record<string, unknown>
): Promise<JobDispatchResponse> {
  return callAIService<JobDispatchResponse>('/jobs/dispatch', {
    job_id: jobId,
    engagement_id: engagementId,
    job_type: jobType,
    payload,
  }, 10_000) // short timeout — this is just an enqueue, not the full job
}
