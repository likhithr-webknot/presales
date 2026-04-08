export interface PricingInput {
  featureBreakdown: {
    module: string
    features: string[]
    tasks: string[]
    estimationNotes?: string
  }[]
  deliveryModel: 'fixed' | 'tm' | 'hybrid'
  timeline: {
    durationWeeks: number
    phases: { name: string; weeks: number }[]
  }
  rateConstraints?: {
    maxBudgetINR?: number
    preferredRatePerDay?: number
  }
  teamCompositionPreferences?: string[]
}

export interface PricingOutput {
  bom: {
    role: string
    effortDays: number
    effortMonths: number
    ratePerDay: number
    totalCostINR: number
  }[]
  totalCostINR: number
  totalCostUSD?: number
  margin: number
  timeline: { phase: string; durationWeeks: number; startWeek: number }[]
  paymentMilestones: {
    milestone: string
    percentageOfTotal: number
    amountINR: number
  }[]
  assumptions: string[]
  warnings: string[]
  rawLLMOutput: string // always preserved — never discard
  normalizedAt: Date
}

export interface IPricingAdapter {
  estimate(input: PricingInput): Promise<PricingOutput>
}
