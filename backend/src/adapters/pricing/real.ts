import { IPricingAdapter, PricingInput, PricingOutput } from './interface'

/**
 * Real Pricing Tool adapter.
 * TODO: Implement when Estimation & Pricing Tool API/interface is finalised.
 * Set PRICING_ADAPTER=real and provide PRICING_API_URL + PRICING_API_KEY in env.
 *
 * NOTE: The Pricing Tool is LLM-based. Its output format is not yet defined.
 * The normalizer in this file must coerce whatever the LLM returns into PricingOutput.
 * Always preserve rawLLMOutput — never discard it.
 */
export class PricingRealAdapter implements IPricingAdapter {
  // Stored for use in Sprint 9 real implementation
  constructor(protected apiUrl: string, protected apiKey: string) {
    void apiUrl; void apiKey // intentionally unused until Sprint 9
  }

  async estimate(_input: PricingInput): Promise<PricingOutput> {
    throw new Error(
      'NotImplementedError: Replace PricingRealAdapter with real implementation when Estimation & Pricing Tool interface is finalised. See PRICING_API_URL and PRICING_API_KEY env vars.'
    )
  }

  // TODO: Implement normalizer here to coerce raw LLM output → PricingOutput schema
  // private normalize(rawOutput: string): PricingOutput { ... }
}
