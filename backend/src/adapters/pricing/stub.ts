import { IPricingAdapter, PricingInput, PricingOutput } from './interface'

export class PricingStubAdapter implements IPricingAdapter {
  async estimate(input: PricingInput): Promise<PricingOutput> {
    console.warn('[PricingAdapter:STUB] estimate called — returning mock BOM')
    const taskCount = input.featureBreakdown.reduce((acc, m) => acc + m.tasks.length, 0)
    const mockTotal = taskCount * 50000

    return {
      bom: [
        { role: 'Tech Lead', effortDays: 60, effortMonths: 2, ratePerDay: 8000, totalCostINR: 480000 },
        { role: 'Backend Developer', effortDays: 90, effortMonths: 3, ratePerDay: 5000, totalCostINR: 450000 },
        { role: 'Frontend Developer', effortDays: 60, effortMonths: 2, ratePerDay: 4500, totalCostINR: 270000 },
      ],
      totalCostINR: mockTotal || 1200000,
      margin: 0.45,
      timeline: [{ phase: 'Phase 1', durationWeeks: 8, startWeek: 1 }],
      paymentMilestones: [
        { milestone: 'Project Kickoff', percentageOfTotal: 30, amountINR: (mockTotal || 1200000) * 0.3 },
        { milestone: 'Mid-point Delivery', percentageOfTotal: 40, amountINR: (mockTotal || 1200000) * 0.4 },
        { milestone: 'Final Delivery', percentageOfTotal: 30, amountINR: (mockTotal || 1200000) * 0.3 },
      ],
      assumptions: ['[STUB] Replace with real Pricing Tool integration (Sprint 9)'],
      warnings: ['⚠ This is stub data. Do not use in actual proposals.'],
      rawLLMOutput: 'STUB_OUTPUT — no LLM called',
      normalizedAt: new Date(),
    }
  }
}
