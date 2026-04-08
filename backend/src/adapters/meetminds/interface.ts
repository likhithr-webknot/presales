export interface DateRange {
  from: Date
  to: Date
}

export interface MeetingMeta {
  meetingId: string
  date: Date
  participants: string[]
  meetingType: string
  durationMinutes: number
}

export interface MeetMindsOutput {
  meetingId: string
  transcript: string
  metadata: {
    date: Date
    participants: string[]
    duration: number
    meetingType: 'discovery' | 'follow_up' | 'demo' | 'other'
  }
  requirements: string[]
  painPoints: string[]
  budgetSignals: string[]
  timelineMentions: string[]
  decisionMakers: { name: string; role: string; authority: 'decision' | 'influence' | 'unknown' }[]
  actionItems: string[]
  competitiveMentions: string[]
}

export interface IMeetMindsAdapter {
  getTranscript(meetingId: string): Promise<MeetMindsOutput>
  listMeetings(params: {
    clientName?: string
    dateRange?: DateRange
    meetingType?: string
  }): Promise<MeetingMeta[]>
  registerWebhook(callbackUrl: string): Promise<void>
}
