// Sample data adapter. Values are in $K. Replace with API calls when the backend list endpoint lands.
export const STAGES = ['Lead qualification', 'Discovery', 'Solutioning', 'Estimation', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const
export type Stage = (typeof STAGES)[number]
export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'

export interface Opportunity {
  id: number
  name: string
  client: string
  value: number
  stage: Stage
  priority: Priority
  prob: number
  owner: string
  close: string
  closeSort: number
  last: string
  lastMinutes: number
}

export const OPPORTUNITIES: Opportunity[] = [
  { id: 1, name: 'Core Banking Modernization', client: 'Meridian Bank', value: 2400, stage: 'Proposal', priority: 'High', prob: 60, owner: 'Priya Nair', close: '12 Dec 2026', closeSort: 20261212, last: '12 min ago', lastMinutes: 12 },
  { id: 2, name: 'Supply Chain Control Tower', client: 'Northline Logistics', value: 1900, stage: 'Negotiation', priority: 'High', prob: 75, owner: 'Priya Nair', close: '28 Nov 2026', closeSort: 20261128, last: 'Yesterday', lastMinutes: 1500 },
  { id: 3, name: 'Data Platform Migration', client: 'Vantage Retail Group', value: 1320, stage: 'Discovery', priority: 'Medium', prob: 25, owner: 'Daniel Okafor', close: '20 Feb 2027', closeSort: 20270220, last: '1 h ago', lastMinutes: 60 },
  { id: 4, name: 'Claims Automation Platform', client: 'Harbor Mutual', value: 346, stage: 'Estimation', priority: 'High', prob: 45, owner: 'Arjun Mehta', close: '15 Jan 2027', closeSort: 20270115, last: '2 h ago', lastMinutes: 120 },
  { id: 5, name: 'Student Information System', client: 'Ridgeview University', value: 980, stage: 'Discovery', priority: 'Medium', prob: 20, owner: 'Sara Lindqvist', close: '10 Mar 2027', closeSort: 20270310, last: 'Yesterday', lastMinutes: 1600 },
  { id: 6, name: 'Patient Portal Rebuild', client: 'Cedar Health Network', value: 860, stage: 'Solutioning', priority: 'Medium', prob: 40, owner: 'Sara Lindqvist', close: '30 Jan 2027', closeSort: 20270130, last: '5 h ago', lastMinutes: 300 },
  { id: 7, name: 'KYC Orchestration', client: 'Solace Payments', value: 720, stage: 'Lead qualification', priority: 'Low', prob: 10, owner: 'Arjun Mehta', close: 'Apr 2027', closeSort: 20270415, last: '3 days ago', lastMinutes: 4300 },
  { id: 8, name: 'Dealer Management Portal', client: 'Kestrel Motors', value: 650, stage: 'Solutioning', priority: 'Low', prob: 30, owner: 'Daniel Okafor', close: '14 Feb 2027', closeSort: 20270214, last: '2 days ago', lastMinutes: 2900 },
  { id: 9, name: 'Field Service Mobile App', client: 'Brightwater Utilities', value: 540, stage: 'Proposal', priority: 'Medium', prob: 55, owner: 'Meera Iyer', close: '18 Dec 2026', closeSort: 20261218, last: '18 min ago', lastMinutes: 18 },
  { id: 10, name: 'Treasury Analytics', client: 'Meridian Bank', value: 430, stage: 'Estimation', priority: 'Medium', prob: 40, owner: 'Meera Iyer', close: '22 Jan 2027', closeSort: 20270122, last: '4 h ago', lastMinutes: 240 },
  { id: 11, name: 'AIOps Pilot', client: 'Altis Telecom', value: 310, stage: 'Lead qualification', priority: 'Urgent', prob: 15, owner: 'Priya Nair', close: 'May 2027', closeSort: 20270515, last: '6 days ago', lastMinutes: 8600 },
]
