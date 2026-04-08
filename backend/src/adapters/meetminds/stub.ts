import { IMeetMindsAdapter, MeetMindsOutput, MeetingMeta } from './interface'

export class MeetMindsStubAdapter implements IMeetMindsAdapter {
  async getTranscript(meetingId: string): Promise<MeetMindsOutput> {
    console.warn(`[MeetMindsAdapter:STUB] getTranscript called — meetingId=${meetingId}`)
    return {
      meetingId,
      transcript: '[STUB] This is a placeholder transcript. Replace MeetMindsStubAdapter with real implementation when MeetMinds++ API is available.',
      metadata: {
        date: new Date(),
        participants: ['Client Representative', 'Account Manager'],
        duration: 60,
        meetingType: 'discovery',
      },
      requirements: ['Build a customer portal', 'Mobile-responsive design'],
      painPoints: ['Current process is entirely manual', 'No real-time visibility into operations'],
      budgetSignals: [],
      timelineMentions: ['Go-live by Q3 2026'],
      decisionMakers: [{ name: 'Unknown', role: 'Unknown', authority: 'unknown' }],
      actionItems: ['Send proposal by end of week'],
      competitiveMentions: [],
    }
  }

  async listMeetings(): Promise<MeetingMeta[]> {
    console.warn('[MeetMindsAdapter:STUB] listMeetings called — returning empty list')
    return []
  }

  async registerWebhook(callbackUrl: string): Promise<void> {
    console.warn(`[MeetMindsAdapter:STUB] registerWebhook ignored — url=${callbackUrl}`)
  }
}
