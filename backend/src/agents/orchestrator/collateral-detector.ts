/**
 * Collateral Detector — delegates to Python AI Service.
 * LLM + rule-based logic has moved to ai-service/workers/collateral_detector.py
 */
import { CollateralType } from '@prisma/client'
import { detectCollateral as aiDetectCollateral } from '../../services/ai-client'

export interface DetectionResult {
  collateralType: CollateralType
  confidence: 'rule' | 'llm'
}

export async function detectCollateralType(
  message: string,
  engagementId?: string
): Promise<DetectionResult> {
  const response = await aiDetectCollateral(message, engagementId)

  return {
    collateralType: response.collateral_type as CollateralType,
    confidence: response.confidence,
  }
}
