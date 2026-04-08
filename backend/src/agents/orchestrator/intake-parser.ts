/**
 * Intake Parser — delegates to Python AI Service.
 * LLM logic has moved to ai-service/workers/intake_parser.py
 */
import { CollateralType } from '@prisma/client'
import { parseIntake as aiParseIntake, ParsedFields as AIParsedFields } from '../../services/ai-client'

export interface ParsedIntake {
  clientName?: string
  domain?: string
  opportunityContext?: string
  contactDetails?: { name?: string; email?: string; role?: string }
  collateralType?: CollateralType
  stage?: number
  missingFields: string[]
  followUpQuestion?: string
  rawMessage: string
}

// Map Python snake_case field names → TS camelCase for missing field labels
const MISSING_FIELD_LABELS: Record<string, string> = {
  client_name:         'clientName',
  domain:              'domain',
  opportunity_context: 'opportunityContext',
}

function mapFromAI(ai: AIParsedFields): Omit<ParsedIntake, 'missingFields' | 'followUpQuestion' | 'rawMessage'> {
  return {
    clientName:        ai.client_name        ?? undefined,
    domain:            ai.domain             ?? undefined,
    opportunityContext: ai.opportunity_context ?? undefined,
    contactDetails:    ai.contact_details     ?? undefined,
    collateralType:    ai.collateral_type     ? (ai.collateral_type as CollateralType) : undefined,
    stage:             ai.stage              ?? undefined,
  }
}

export async function parseIntake(
  message: string,
  existingContext?: Partial<ParsedIntake>
): Promise<ParsedIntake> {
  // Map TS camelCase → Python snake_case for existing context
  const existingForAI: Partial<AIParsedFields> | undefined = existingContext
    ? {
        client_name:         existingContext.clientName,
        domain:              existingContext.domain,
        opportunity_context: existingContext.opportunityContext,
        contact_details:     existingContext.contactDetails,
        collateral_type:     existingContext.collateralType,
        stage:               existingContext.stage,
      }
    : undefined

  const response = await aiParseIntake(message, existingForAI)

  // Map missing field names back to camelCase for the rest of the Node codebase
  const missingFields = response.missing_fields.map(
    (f) => MISSING_FIELD_LABELS[f] ?? f
  )

  return {
    ...mapFromAI(response.parsed),
    missingFields,
    followUpQuestion: response.follow_up_question ?? undefined,
    rawMessage: message,
  }
}
