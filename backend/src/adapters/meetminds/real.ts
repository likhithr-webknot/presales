import { IMeetMindsAdapter, MeetMindsOutput, MeetingMeta, DateRange } from './interface'

/**
 * Real MeetMinds++ adapter.
 * TODO: Implement when MeetMinds++ API is available.
 * Set MEETMINDS_ADAPTER=real and provide MEETMINDS_API_URL + MEETMINDS_API_KEY in env.
 */
export class MeetMindsRealAdapter implements IMeetMindsAdapter {
  // Stored for use in Sprint 9 real implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(protected apiUrl: string, protected apiKey: string) {
    void apiUrl; void apiKey // intentionally unused until Sprint 9
  }

  async getTranscript(_meetingId: string): Promise<MeetMindsOutput> {
    throw new Error(
      'NotImplementedError: Replace MeetMindsRealAdapter with real implementation when MeetMinds++ API is available. See MEETMINDS_API_URL and MEETMINDS_API_KEY env vars.'
    )
  }

  async listMeetings(_params: { clientName?: string; dateRange?: DateRange; meetingType?: string }): Promise<MeetingMeta[]> {
    throw new Error('NotImplementedError: MeetMinds++ API not yet implemented.')
  }

  async registerWebhook(_callbackUrl: string): Promise<void> {
    throw new Error('NotImplementedError: MeetMinds++ webhook not yet implemented.')
  }
}
