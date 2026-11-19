export interface NavItem {
  id: string
  label: string
  /** Route path, or undefined when the screen is not built yet. */
  to?: string
  icon: string
  badge?: number
}
export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

export const NAV: NavSection[] = [
  {
    id: 'ws',
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', to: '/dashboard', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
      { id: 'mywork', label: 'My Work', badge: 7, icon: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
      { id: 'opportunities', label: 'Opportunities', to: '/opportunities', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z' },
      { id: 'accounts', label: 'Accounts & Clients', icon: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4' },
      { id: 'activity', label: 'Activity', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    ],
  },
  {
    id: 'ops',
    label: 'Presales operations',
    items: [
      { id: 'requirements', label: 'Requirements', to: '/requirements', icon: 'M3 6l2 2 3-3M3 16l2 2 3-3M12 7h9M12 17h9' },
      { id: 'architecture', label: 'Solution Architecture', icon: 'M9 3h6v6H9zM3 15h6v6H3zM15 15h6v6h-6zM12 9v3M6 15v-3h12v3' },
      { id: 'estimations', label: 'Estimations', to: '/estimations', icon: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8' },
      { id: 'proposals', label: 'Proposals & RFPs', to: '/proposals', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5' },
      { id: 'approvals', label: 'Approvals', to: '/approvals', badge: 4, icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4' },
      { id: 'handoffs', label: 'Delivery Handoffs', icon: 'M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12' },
    ],
  },
  {
    id: 'intel',
    label: 'Intelligence',
    items: [
      { id: 'copilot', label: 'AI Copilot', to: '/copilot', icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z' },
      { id: 'knowledge', label: 'Knowledge Base', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5' },
      { id: 'analytics', label: 'Analytics', icon: 'M3 3v18h18M8 17v-5M13 17V8M18 17v-9' },
      { id: 'automations', label: 'Workflow Automations', icon: 'M13 2L3 14h9l-1 8 10-12h-9z' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'team', label: 'Team Members', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
      { id: 'templates', label: 'Templates', icon: 'M3 3h18v7H3zM3 14h7v7H3zM14 14h7v7h-7z' },
      { id: 'integrations', label: 'Integrations', icon: 'M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z' },
      { id: 'settings', label: 'Settings', to: '/admin', icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6' },
    ],
  },
]

/** Breadcrumb metadata keyed by route prefix (longest match wins). */
export const CRUMBS: { prefix: string; section: string; page: string; sub?: string }[] = [
  { prefix: '/dashboard', section: 'Workspace', page: 'Overview' },
  { prefix: '/opportunities', section: 'Workspace', page: 'Opportunities' },
  { prefix: '/engagements', section: 'Workspace', page: 'Opportunities', sub: 'Core Banking Modernization' },
  { prefix: '/requirements', section: 'Presales operations', page: 'Requirements', sub: 'RFP extraction review' },
  { prefix: '/estimations', section: 'Presales operations', page: 'Estimations', sub: 'Estimate v3' },
  { prefix: '/proposals', section: 'Presales operations', page: 'Proposals & RFPs', sub: 'Proposal builder' },
  { prefix: '/approvals', section: 'Presales operations', page: 'Approvals' },
  { prefix: '/copilot', section: 'Intelligence', page: 'AI Copilot' },
  { prefix: '/foundations', section: 'Administration', page: 'Design foundations' },
  { prefix: '/admin', section: 'Administration', page: 'Settings' },
]
