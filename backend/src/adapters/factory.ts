import { env } from '../config/env'
import { IMeetMindsAdapter } from './meetminds/interface'
import { MeetMindsStubAdapter } from './meetminds/stub'
import { MeetMindsRealAdapter } from './meetminds/real'
import { IPricingAdapter } from './pricing/interface'
import { PricingStubAdapter } from './pricing/stub'
import { PricingRealAdapter } from './pricing/real'
import { IKnowledgeBaseAdapter } from './knowledge-base/interface'
import { KnowledgeBaseStubAdapter } from './knowledge-base/stub'
import { KnowledgeBaseRealAdapter } from './knowledge-base/real'

export function getMeetMindsAdapter(): IMeetMindsAdapter {
  if (env.MEETMINDS_ADAPTER === 'real') {
    if (!env.MEETMINDS_API_URL || !env.MEETMINDS_API_KEY) {
      throw new Error('MEETMINDS_ADAPTER=real requires MEETMINDS_API_URL and MEETMINDS_API_KEY')
    }
    console.log('[Adapters] MeetMinds: REAL')
    return new MeetMindsRealAdapter(env.MEETMINDS_API_URL, env.MEETMINDS_API_KEY)
  }
  console.log('[Adapters] MeetMinds: STUB')
  return new MeetMindsStubAdapter()
}

export function getPricingAdapter(): IPricingAdapter {
  if (env.PRICING_ADAPTER === 'real') {
    if (!env.PRICING_API_URL || !env.PRICING_API_KEY) {
      throw new Error('PRICING_ADAPTER=real requires PRICING_API_URL and PRICING_API_KEY')
    }
    console.log('[Adapters] Pricing: REAL')
    return new PricingRealAdapter(env.PRICING_API_URL, env.PRICING_API_KEY)
  }
  console.log('[Adapters] Pricing: STUB')
  return new PricingStubAdapter()
}

export function getKnowledgeBaseAdapter(): IKnowledgeBaseAdapter {
  if (env.KB_ADAPTER === 'real') {
    console.log('[Adapters] KnowledgeBase: REAL')
    return new KnowledgeBaseRealAdapter()
  }
  console.log('[Adapters] KnowledgeBase: STUB')
  return new KnowledgeBaseStubAdapter()
}

// Singleton instances — initialised once at startup via initAdapters()
let _meetminds: IMeetMindsAdapter | undefined
let _pricing: IPricingAdapter | undefined
let _kb: IKnowledgeBaseAdapter | undefined

export function initAdapters(): void {
  _meetminds = getMeetMindsAdapter()
  _pricing = getPricingAdapter()
  _kb = getKnowledgeBaseAdapter()
}

function assertInit<T>(adapter: T | undefined, name: string): T {
  if (!adapter) throw new Error(`[Adapters] ${name} not initialized — call initAdapters() at startup before using adapters`)
  return adapter
}

export const adapters = {
  get meetminds(): IMeetMindsAdapter { return assertInit(_meetminds, 'MeetMinds') },
  get pricing(): IPricingAdapter { return assertInit(_pricing, 'Pricing') },
  get kb(): IKnowledgeBaseAdapter { return assertInit(_kb, 'KnowledgeBase') },
}
