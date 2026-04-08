# LLD — Presales Orchestrator
*Low-Level Design | Version 1.0 | April 2026*

---

## 1. Prisma Schema (Complete)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users & Auth ────────────────────────────────────────────────────────────

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  avatarUrl     String?
  googleId      String    @unique
  roles         UserRole[]
  engagements   Engagement[]       // created by this user
  approvals     GateApproval[]
  auditLogs     AuditLog[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum RoleType {
  AM
  DM
  SALES_HEAD
  REVIEWER
  ADMIN
}

model UserRole {
  id        String    @id @default(uuid())
  userId    String
  role      RoleType
  user      User      @relation(fields: [userId], references: [id])
  createdAt DateTime  @default(now())

  @@unique([userId, role])
}

// ─── Engagements ─────────────────────────────────────────────────────────────

enum EngagementStage {
  STAGE_1
  STAGE_2
  STAGE_3
  STAGE_4
  STAGE_5
}

enum EngagementStatus {
  INITIATED
  RESEARCH_COMPLETE
  PROPOSAL_IN_PROGRESS
  UNDER_REVIEW
  APPROVED
  DELIVERED
  BLOCKED
}

enum CollateralType {
  FIRST_MEETING_DECK
  POST_DISCOVERY_DECK
  TECHNICAL_PROPOSAL
  PROPOSAL_DEFENSE_DECK
  STATEMENT_OF_WORK
  COMMERCIAL_ESTIMATION
  CASE_STUDY_DOCUMENT
  MARKETING_CONTENT
}

model Engagement {
  id              String            @id @default(uuid())
  clientName      String
  domain          String
  opportunityContext String?
  contactDetails  Json?             // { name, email, role, linkedin }
  stage           EngagementStage
  status          EngagementStatus  @default(INITIATED)
  collateralType  CollateralType
  currentBlocker  String?
  createdById     String
  createdBy       User              @relation(fields: [createdById], references: [id])
  versions        EngagementVersion[]
  gateApprovals   GateApproval[]
  agentJobs       AgentJob[]
  reviewers       EngagementReviewer[]
  uploads         EngagementUpload[]
  auditLogs       AuditLog[]
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}

model EngagementVersion {
  id              String      @id @default(uuid())
  engagementId    String
  engagement      Engagement  @relation(fields: [engagementId], references: [id])
  version         Int
  triggeredByUserId String?
  changeReason    String?     // what feedback drove this version
  diffSummary     String?     // LLM-generated plain language diff from previous version
  artifacts       Json        // full section-wise JSON snapshot at this version
  isLatest        Boolean     @default(true)
  createdAt       DateTime    @default(now())

  @@unique([engagementId, version])
}

model EngagementReviewer {
  id            String      @id @default(uuid())
  engagementId  String
  engagement    Engagement  @relation(fields: [engagementId], references: [id])
  reviewerId    String
  gateNumber    Int?        // null = all gates; number = specific gate only
  isAlternate   Boolean     @default(false)
  createdAt     DateTime    @default(now())
}

// ─── Gate Approvals ──────────────────────────────────────────────────────────

enum GateStatus {
  PENDING
  APPROVED
  APPROVED_WITH_FEEDBACK
  REJECTED
}

enum GateNumber {
  GATE_1
  GATE_2
  GATE_3
  DEFENSE_GATE
  SOW_AM
  SOW_DM
}

model GateApproval {
  id              String      @id @default(uuid())
  engagementId    String
  engagement      Engagement  @relation(fields: [engagementId], references: [id])
  gateNumber      GateNumber
  reviewerId      String
  reviewer        User        @relation(fields: [reviewerId], references: [id])
  status          GateStatus  @default(PENDING)
  feedback        String?
  complianceMatrix Json?      // { dimensions: [...], overallScore, highVarianceAreas }
  approvedAt      DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

// ─── Agent Jobs ──────────────────────────────────────────────────────────────

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum AgentName {
  ORCHESTRATOR
  SECONDARY_RESEARCH
  CONTEXT_MANAGER
  MEETMINDS_ADAPTER
  PRICING_ADAPTER
  CASE_STUDY_MAKER
  SOW_MAKER
  PROPOSAL_MAKER
  NARRATIVE_AGENT
  TECHNICAL_SOLUTION
  PACKAGING_AGENT
  COMPLIANCE_SCORER
}

model AgentJob {
  id              String      @id @default(uuid())
  engagementId    String
  engagement      Engagement  @relation(fields: [engagementId], references: [id])
  agentName       AgentName
  bullmqJobId     String?     // BullMQ's internal job ID
  status          JobStatus   @default(QUEUED)
  input           Json
  output          Json?
  error           String?
  retryCount      Int         @default(0)
  parentJobId     String?     // for sub-agent jobs spawned by Proposal Maker
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime    @default(now())
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

enum UploadType {
  RFP
  REQUIREMENT_DOC
  QA_SPREADSHEET
  PREVIOUS_PROPOSAL
  CLIENT_BRIEF
  SOW_TEMPLATE
  OTHER
}

model EngagementUpload {
  id              String      @id @default(uuid())
  engagementId    String
  engagement      Engagement  @relation(fields: [engagementId], references: [id])
  uploadType      UploadType
  fileName        String
  mimeType        String
  storageKey      String      // MinIO key
  parsedContent   Json?       // extracted text/structure post-parse
  uploadedById    String
  createdAt       DateTime    @default(now())
}

// ─── Knowledge Base ──────────────────────────────────────────────────────────

enum KBEntryType {
  PROJECT
  CAPABILITY
  CASE_STUDY
  TEAM_PROFILE
  DIFFERENTIATOR
  WEDGE_OFFERING
  MARKETING_ASSET
}

model KnowledgeBaseEntry {
  id          String        @id @default(uuid())
  type        KBEntryType
  title       String
  content     String        // full text content
  metadata    Json          // domain, techStack, outcomes, metrics, etc.
  // embedding column added via raw SQL migration (pgvector)
  // embedding  Unsupported("vector(1536)")?
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

// ─── System Config ───────────────────────────────────────────────────────────

model SystemConfig {
  id        String    @id @default(uuid())
  key       String    @unique
  value     String
  updatedAt DateTime  @updatedAt
}
// Keys: gate_reminder_hours, min_reviewer_count, compliance_variance_threshold

// ─── Audit Log ───────────────────────────────────────────────────────────────

enum AuditAction {
  ENGAGEMENT_CREATED
  STAGE_ADVANCED
  AGENT_INVOKED
  AGENT_COMPLETED
  AGENT_FAILED
  GATE_SENT_FOR_REVIEW
  GATE_APPROVED
  GATE_REJECTED
  GATE_OVERRIDDEN
  REVISION_REQUESTED
  VERSION_CREATED
  ARTIFACT_DOWNLOADED
  SOW_SECTION_CONFIRMED
  OVERRIDE_APPLIED
}

model AuditLog {
  id            String      @id @default(uuid())
  engagementId  String
  engagement    Engagement  @relation(fields: [engagementId], references: [id])
  userId        String?
  user          User?       @relation(fields: [userId], references: [id])
  action        AuditAction
  detail        Json?       // action-specific payload
  createdAt     DateTime    @default(now())
}
```

---

## 2. Express Route Definitions

All routes prefixed with `/api`. Auth middleware applied globally except `/auth/*`.

### 2.1 Auth Routes
```
GET  /auth/google              → initiate Google OAuth2 flow
GET  /auth/google/callback     → OAuth2 callback, set JWT cookie, redirect to dashboard
POST /auth/logout              → clear JWT cookie
GET  /auth/me                  → return current user + roles
```

### 2.2 Engagement Routes
```
POST   /api/engagements
  Auth: AM
  Body: { clientName, domain, opportunityContext?, collateralType, stage, contactDetails? }
  Handler: createEngagement → returns Engagement

GET    /api/engagements
  Auth: AM | DM | SALES_HEAD | ADMIN
  Query: { status?, stage?, collateralType?, page, limit }
  Handler: listEngagements (filtered by role — AM sees own; ADMIN sees all)

GET    /api/engagements/:id
  Auth: engagement participant
  Handler: getEngagement → full engagement with current version + active jobs

PATCH  /api/engagements/:id
  Auth: AM (own engagement)
  Body: partial Engagement fields (clientName, domain, opportunityContext, etc.)
  Handler: updateEngagementMeta

DELETE /api/engagements/:id
  Auth: ADMIN only
  Handler: soft-delete (set status = CANCELLED, don't remove data)
```

### 2.3 Orchestrator Interaction Routes
```
POST   /api/engagements/:id/message
  Auth: AM | DM (SOW stage only)
  Body: { message: string, attachmentIds?: string[] }
  Handler: sendToOrchestrator → parses intent → dispatches jobs → returns { jobIds, nextPrompt? }

POST   /api/engagements/:id/feedback
  Auth: AM
  Body: { feedback: string, targetSection?: string, targetAgentJob?: string }
  Handler: submitFeedback → Orchestrator routes to correct agent → new version created

POST   /api/engagements/:id/advance-stage
  Auth: AM
  Body: { toStage: EngagementStage }
  Handler: advanceStage → validates current stage complete → loads carry-forward context
```

### 2.4 Gate & Approval Routes
```
POST   /api/engagements/:id/gates/:gateNumber/submit
  Auth: AM
  Handler: submitForGateReview → triggers multi-LLM scoring → sends emails to reviewers

GET    /api/engagements/:id/gates/:gateNumber
  Auth: engagement participant
  Handler: getGateStatus → { approvals: [], complianceMatrix, overallStatus }

POST   /api/engagements/:id/gates/:gateNumber/approve
  Auth: REVIEWER | SALES_HEAD (defense) | AM | DM (SOW)
  Body: { status: 'approved' | 'approved_with_feedback' | 'rejected', feedback?: string }
  Handler: recordApproval → check if min approvers met → if met, advance

POST   /api/engagements/:id/gates/:gateNumber/override
  Auth: AM
  Body: { justification: string }
  Handler: overrideGate → log override → advance without full reviewer count

POST   /api/engagements/:id/gates/:gateNumber/assign-reviewer
  Auth: AM | ADMIN
  Body: { reviewerId: string, isAlternate?: boolean }
  Handler: assignReviewer → send email notification
```

### 2.5 Version & Artifact Routes
```
GET    /api/engagements/:id/versions
  Auth: engagement participant
  Handler: listVersions → array of EngagementVersion summaries

GET    /api/engagements/:id/versions/:version
  Auth: engagement participant
  Handler: getVersion → full artifact JSON for that version

GET    /api/engagements/:id/versions/:version/diff
  Auth: engagement participant
  Handler: getVersionDiff → { diffSummary, changedSections }

GET    /api/engagements/:id/artifacts/download
  Auth: engagement participant
  Query: { version?, format: 'pptx'|'docx'|'xlsx' }
  Handler: getArtifactDownloadUrl → presigned MinIO URL
```

### 2.6 Upload Routes
```
POST   /api/uploads
  Auth: AM
  Content-Type: multipart/form-data
  Body: { file, engagementId, uploadType }
  Handler: uploadDocument → store in MinIO → parse content → return EngagementUpload

GET    /api/uploads/:id
  Auth: engagement participant
  Handler: getUpload metadata

DELETE /api/uploads/:id
  Auth: AM (own uploads only)
  Handler: soft-delete upload record + remove from MinIO
```

### 2.7 Job Routes
```
GET    /api/jobs/:jobId
  Auth: engagement participant
  Handler: getJobStatus → { status, progress, output?, error? }

POST   /api/jobs/:jobId/retry
  Auth: AM
  Handler: retryJob → re-queue failed job

POST   /api/jobs/:jobId/cancel
  Auth: AM | ADMIN
  Handler: cancelJob → BullMQ job cancel
```

### 2.8 Knowledge Base Routes (Admin)
```
GET    /api/kb
  Auth: ADMIN
  Query: { type?, search?, page, limit }
  Handler: listKBEntries

POST   /api/kb
  Auth: ADMIN
  Body: { type, title, content, metadata }
  Handler: createKBEntry → generate embedding → store

PUT    /api/kb/:id
  Auth: ADMIN
  Handler: updateKBEntry → regenerate embedding

DELETE /api/kb/:id
  Auth: ADMIN
  Handler: deactivateKBEntry (soft delete)
```

### 2.9 User & Config Routes (Admin)
```
GET    /api/users               Auth: ADMIN → list users
PATCH  /api/users/:id/roles     Auth: ADMIN → assign/revoke roles
GET    /api/config              Auth: ADMIN → get system config
PATCH  /api/config              Auth: ADMIN → update config keys (reminder hours, min reviewers, etc.)
```

---

## 3. BullMQ Queue Definitions

```typescript
// src/jobs/queues.ts

import { Queue, Worker, QueueEvents } from 'bullmq'
import { redisConnection } from '../config/redis'

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: false,
}

export const queues = {
  research:    new Queue('research',    { connection: redisConnection }),
  context:     new Queue('context',     { connection: redisConnection }),
  casestudy:   new Queue('casestudy',   { connection: redisConnection }),
  sow:         new Queue('sow',         { connection: redisConnection }),
  narrative:   new Queue('narrative',   { connection: redisConnection }),
  technical:   new Queue('technical',   { connection: redisConnection }),
  packaging:   new Queue('packaging',   { connection: redisConnection }),
  pricing:     new Queue('pricing',     { connection: redisConnection }),
  scoring:     new Queue('scoring',     { connection: redisConnection }),
  email:       new Queue('email',       { connection: redisConnection }),
  diffgen:     new Queue('diffgen',     { connection: redisConnection }),
}

// Queue concurrency config
export const QUEUE_CONCURRENCY = {
  research:  3,   // up to 3 simultaneous research jobs
  context:   3,
  casestudy: 3,
  sow:       2,
  narrative: 2,
  technical: 2,
  packaging: 5,   // packaging is lighter, higher concurrency ok
  pricing:   3,
  scoring:   5,   // 3 LLMs × up to ~2 engagements parallel
  email:     10,
  diffgen:   5,
}

// Job type definitions per queue
export type ResearchJobData = {
  engagementId: string
  jobId: string          // AgentJob DB id
  depth: 'light' | 'medium' | 'deep'
  clientName: string
  domain: string
  website?: string
  opportunityContext: string
  specificRequests?: string[]
}

export type ContextJobData = {
  engagementId: string
  jobId: string
  prospectContext: { domain: string, opportunityType: string, requiredCapabilities: string[] }
  specificAsk?: string
  framingGuidance?: string   // from Narrative Agent
}

export type CaseStudyJobData = {
  engagementId: string
  jobId: string
  targetDomain: string
  capabilityToHighlight: string
  clientContext: string
  framingGuidance?: string
  count: number
}

export type NarrativeJobData = {
  engagementId: string
  jobId: string
  phase: 'positioning' | 'content' | 'coherence_pass'
  researchBrief?: object
  webknotContext?: object
  callNotes?: object
  technicalSolution?: object
  caseStudies?: object[]
  pricingOutput?: object
  amInstructions?: string
}

export type TechnicalJobData = {
  engagementId: string
  jobId: string
  requirements: { functional: string[], nonFunctional: string[] }
  rfpTechRequirements?: string[]
  constraints: { budget?: number, timeline?: string, mandatedStack?: string[] }
  researchContext: object
  webknotCapabilities: object
}

export type PackagingJobData = {
  engagementId: string
  jobId: string
  collateralType: string
  outputFormat: 'pptx' | 'docx' | 'xlsx'
  contentSections: object   // assembled section JSON
  submissionRequirements?: { pageLimit?: number, mandatorySections?: string[], fileNaming?: string }
  templateKey?: string      // MinIO key for template file
}

export type ScoringJobData = {
  engagementId: string
  jobId: string
  gateNumber: string
  rfpContent: string
  deliverableContent: object
  dimensions: string[]
}

export type EmailJobData = {
  template: 'gate_review' | 'gate_approved' | 'gate_rejected' | 'gate_reminder' |
            'sow_approval' | 'artifact_ready' | 'agent_failed'
  to: string[]
  cc?: string[]
  templateData: Record<string, string>
}
```

---

## 4. LLM Router Logic

```typescript
// src/services/llm/router.ts

export enum LLMTier {
  CHEAP  = 'cheap',   // GPT-5 Mini
  MID    = 'mid',     // GPT-5.1
  PREMIUM = 'premium' // Claude Sonnet 4.6
}

export enum TaskType {
  // CHEAP
  INTAKE_PARSING        = 'intake_parsing',
  STATUS_SUMMARY        = 'status_summary',
  EMAIL_GENERATION      = 'email_generation',
  REMINDER_TEXT         = 'reminder_text',
  DIFF_EXPLANATION      = 'diff_explanation',
  CONTEXT_CARRYFORWARD  = 'context_carryforward',
  BLOCKER_DETECTION     = 'blocker_detection',
  APPROVAL_SUMMARY      = 'approval_summary',
  PRICING_EXPLANATION   = 'pricing_explanation',
  PACKAGE_EXPORT        = 'package_export',
  // MID
  RESEARCH_SYNTHESIS    = 'research_synthesis',
  SECTION_DRAFT         = 'section_draft',
  CASE_STUDY_GENERATION = 'case_study_generation',
  CRITIC_REVIEW         = 'critic_review',
  COMPLIANCE_SCORING    = 'compliance_scoring',
  DOCUMENT_GENERATION   = 'document_generation',
  TEMPLATE_ASSIST       = 'template_assist',
  // PREMIUM
  NARRATIVE_POSITIONING = 'narrative_positioning',
  NARRATIVE_COHERENCE   = 'narrative_coherence',
  TECHNICAL_ARCHITECTURE = 'technical_architecture',
  SOW_GENERATION        = 'sow_generation',
  EXECUTIVE_SUMMARY     = 'executive_summary',
}

const TASK_TIER_MAP: Record<TaskType, LLMTier> = {
  [TaskType.INTAKE_PARSING]:         LLMTier.CHEAP,
  [TaskType.STATUS_SUMMARY]:         LLMTier.CHEAP,
  [TaskType.EMAIL_GENERATION]:       LLMTier.CHEAP,
  [TaskType.REMINDER_TEXT]:          LLMTier.CHEAP,
  [TaskType.DIFF_EXPLANATION]:       LLMTier.CHEAP,
  [TaskType.CONTEXT_CARRYFORWARD]:   LLMTier.CHEAP,
  [TaskType.BLOCKER_DETECTION]:      LLMTier.CHEAP,
  [TaskType.APPROVAL_SUMMARY]:       LLMTier.CHEAP,
  [TaskType.PRICING_EXPLANATION]:    LLMTier.CHEAP,
  [TaskType.PACKAGE_EXPORT]:         LLMTier.CHEAP,
  [TaskType.RESEARCH_SYNTHESIS]:     LLMTier.MID,
  [TaskType.SECTION_DRAFT]:          LLMTier.MID,
  [TaskType.CASE_STUDY_GENERATION]:  LLMTier.MID,
  [TaskType.CRITIC_REVIEW]:          LLMTier.MID,
  [TaskType.COMPLIANCE_SCORING]:     LLMTier.MID,
  [TaskType.DOCUMENT_GENERATION]:    LLMTier.MID,
  [TaskType.TEMPLATE_ASSIST]:        LLMTier.MID,
  [TaskType.NARRATIVE_POSITIONING]:  LLMTier.PREMIUM,
  [TaskType.NARRATIVE_COHERENCE]:    LLMTier.PREMIUM,
  [TaskType.TECHNICAL_ARCHITECTURE]: LLMTier.PREMIUM,
  [TaskType.SOW_GENERATION]:         LLMTier.PREMIUM,
  [TaskType.EXECUTIVE_SUMMARY]:      LLMTier.PREMIUM,
}

const TIER_MODELS: Record<LLMTier, { provider: 'openai' | 'anthropic', model: string }> = {
  [LLMTier.CHEAP]:   { provider: 'openai',    model: 'gpt-5-mini'    },
  [LLMTier.MID]:     { provider: 'openai',    model: 'gpt-5.1'       },
  [LLMTier.PREMIUM]: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
}

export function getModelForTask(task: TaskType) {
  const tier = TASK_TIER_MAP[task]
  return TIER_MODELS[tier]
}

// Compliance scoring uses all 3 providers simultaneously
export const SCORING_MODELS = [
  { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  { provider: 'openai',    model: 'gpt-5.1'           },
  { provider: 'google',    model: 'gemini-2.0-flash'  },  // exact model TBD on Gemini API availability
]
```

---

## 5. Agent Internal Logic Flows

### 5.1 Secondary Research Agent
```
INPUT: ResearchJobData
  1. Construct search queries from clientName, domain, opportunityContext
  2. Web search: company overview, recent news, leadership, strategic priorities
  3. Web search: tech stack signals (job postings, press, partnerships)
  4. Web search: industry context, market trends, competitive landscape
  5. Depth scaling:
     - light:  steps 2+4 only, ~3-5 sources
     - medium: all steps, 5-10 sources, targeted by call context
     - deep:   all steps, 10-20 sources, compliance/integration landscape added
  6. Synthesize via GPT-5.1 into structured ResearchBrief
  7. Validate output schema — if thin (< minimum source threshold), flag partial result
  8. Return ResearchBrief JSON

OUTPUT SCHEMA: {
  clientBackground: { overview, leadership, recentNews, strategicPriorities, techLandscape },
  industryContext: { marketSize, growthTrends, regulatoryEnv, keyChallenges },
  competitiveLandscape: { competitors, differentiators },
  technologySignals: string[],
  opportunityInsights: { painPoints, potentialScope, budgetIndicators },
  sourceUrls: string[],
  depth: 'light'|'medium'|'deep',
  confidence: 'high'|'medium'|'low',   // low = flag to AM
  warnings: string[]   // e.g. "Limited public information found for this domain"
}
```

### 5.2 Webknot Context Manager
```
INPUT: ContextJobData
  1. Extract search dimensions: domain, capability, opportunity type
  2. KnowledgeBaseAdapter.searchProjects(query, filters)
  3. KnowledgeBaseAdapter.searchCapabilities(query)
  4. KnowledgeBaseAdapter.getPositioning(prospectContext)
  5. If framingGuidance provided: filter and rank results by framing angle
  6. Generate positioning narrative via GPT-5.1
  7. Return WebknotContextOutput

OUTPUT SCHEMA: {
  relevantProjects: ProjectRecord[],
  capabilityPositioning: { service, relevance, framingStatement }[],
  teamHighlights: string[],
  differentiatorStatements: string[],
  wedgeOfferings: { code: string, description, relevance }[],
  generatedPositioning: string,  // 2-3 para narrative for "Why Webknot"
  warnings: string[]   // e.g. "No projects found matching retail domain — using adjacent matches"
}
```

### 5.3 Narrative/Storyline Agent
```
Phase: 'positioning'
INPUT: research brief, webknot context, call notes, AM instructions
  1. Analyze client pain points vs Webknot strengths
  2. Determine strongest narrative angle (speed / domain depth / cost / innovation)
  3. Propose section structure (dynamic, not fixed template)
  4. Write section-level messaging briefs (2-3 lines each)
  5. Write value proposition statement
  6. Return NarrativePositioningOutput (for Gate 1)

Phase: 'content'
INPUT: approved positioning + technical solution + case studies
  1. Write executive summary (last, after all other sections)
  2. Write section prose (openings, closings, connective tissue)
  3. Write value proposition section (ROI, differentiation, risk framing)
  4. Return NarrativeContentOutput

Phase: 'coherence_pass'
INPUT: all section outputs (technical, case studies, pricing, narrative)
  1. Review for consistent tone and terminology
  2. Verify story arc: problem → understanding → solution → proof → investment → next steps
  3. Flag inconsistencies (e.g., technical promises X but pricing excludes it)
  4. Return CoherencePassOutput { approved: boolean, flags: string[], revisedSections?: object }

OUTPUT SCHEMA (positioning): {
  narrativeAngle: string,
  sectionStructure: { sectionId, title, purpose, keyMessage, wordCountTarget }[],
  valueProposition: string,
  positioningStatement: string,
  toneGuidance: 'enterprise_formal'|'startup_friendly'|'government_public_sector'
}
```

### 5.4 Technical Solution Agent
```
INPUT: TechnicalJobData
  1. Parse and classify requirements (functional vs non-functional)
  2. Identify gaps or ambiguities — list them explicitly
  3. Design system architecture appropriate to scope + budget
  4. Select tech stack with rationale
  5. Design integration approach with client's existing systems
  6. Plan infrastructure (hosting, CI/CD, monitoring)
  7. Define security and compliance approach
  8. Plan scalability
  9. Decompose into feature/module breakdown (compatible with Pricing Tool input schema)
  10. Assess feasibility — flag aggressive timelines, recommend phasing
  11. Generate architecture diagram as structured JSON (renderable by Packaging Agent)
  12. Return TechnicalSolutionOutput

OUTPUT SCHEMA: {
  architecture: { overview, components, dataFlow, diagramJson },
  techStack: { item, choice, rationale, alternatives }[],
  integrations: { system, approach, complexity }[],
  infrastructure: { hosting, cicd, monitoring, environments },
  security: { auth, dataProtection, compliance },
  scalability: string,
  featureBreakdown: { module, features: string[], tasks: string[], estimationNotes }[],
  feasibilityFlags: { area, risk, recommendation }[],
  requirementGaps: string[]
}
```

### 5.5 Case Study Maker
```
INPUT: CaseStudyJobData
  1. KnowledgeBaseAdapter.searchCaseStudies(domain + capability)
  2. Rank by relevance to prospect context
  3. For each project selected:
     a. Retrieve base project data
     b. Generate tailored write-up angled to framingGuidance
     c. Anonymize if flagged in KB metadata
  4. Return array of CaseStudy objects

OUTPUT SCHEMA per case study: {
  projectCodename: string,
  clientBackground: string,  // anonymized if needed
  challengeStatement: string,
  solutionApproach: string,
  technologiesUsed: string[],
  outcomes: { metric, before, after }[],
  relevanceStatement: string,  // why this is relevant to the current prospect
  format: 'embeddable'|'standalone'|'slide_ready'
}
```

### 5.6 SOW Maker
```
INPUT: { approvedProposal, sowTemplate, commercialTerms, legalRequirements }
  Sections (sequential, each requires AM confirmation before proceeding):
  1. IN_SCOPE         → extract from proposal, make specific + measurable
  2. OUT_OF_SCOPE     → explicitly list exclusions
  3. ASSUMPTIONS      → list all assumptions with "if broken" consequences
  4. DEPENDENCIES     → client + third-party dependencies with owners + timelines
  5. DELIVERABLES     → specific artifacts with acceptance criteria
  6. MILESTONES       → phase-wise timeline
  7. PAYMENT_TERMS    → milestone-based payment schedule
  8. SLAS             → response times, uptime, support terms
  9. ACCEPTANCE       → acceptance criteria and process
  10. IP_OWNERSHIP    → IP clauses
  11. CONFIDENTIALITY → NDA terms
  12. WARRANTY        → warranty period and scope
  13. TERMINATION     → termination conditions and consequences
  14. DISPUTE_RESOLUTION → jurisdiction and process

  For each section:
    → Generate content via Sonnet 4.6
    → Validate: zero vague language (banned words: ensure, make sure, seamless, all-encompassing)
    → WebSocket event: sow_section_ready { section, content }
    → Wait for AM confirmation signal before proceeding
    → AM can iterate within section before confirming

OUTPUT: Structured JSON with all confirmed sections → Packaging Agent assembles DOCX
```

### 5.7 Packaging Agent
```
INPUT: PackagingJobData
  1. Load template from MinIO (templateKey or default by collateralType)
  2. Apply brand styling (dark navy headers, electric cyan accents, clean sans-serif)
  3. Based on outputFormat:
     PPTX: PptxGenJS → map sections to slides, apply master template
     DOCX: docxtemplater → populate template placeholders with section content
     XLSX: exceljs → render BOM/pricing tables
  4. Quality checks:
     - No placeholder text remaining (scan for {{, [[, TBD, INSERT, PLACEHOLDER)
     - All cross-references resolve
     - Pricing figures match estimation sheet (for proposals)
     - No tracked changes or comments in output
  5. Upload final file to MinIO: presales-artifacts/{engagementId}/{version}/{filename}
  6. Return { storageKey, downloadUrl (presigned, 24h TTL), fileSize, qualityChecksPassed }
```

### 5.8 Multi-LLM Compliance Scorer
```
INPUT: { rfpContent, deliverableContent, dimensions }
  1. Extract scoring dimensions from RFP (or use defaults if no RFP)
  2. Dispatch 3 parallel scoring jobs (Claude, GPT-5.1, Gemini)
     Each job: "Score this deliverable against dimension X on scale 1-5, with reasoning"
  3. Await all 3 results
  4. For each dimension:
     a. Calculate mean score
     b. Calculate standard deviation
     c. If stddev > COMPLIANCE_VARIANCE_THRESHOLD (configurable, default 1.0):
        → Mark as HIGH_VARIANCE → requires explicit human judgment
     d. Generate improvement suggestion if mean < 3
  5. Return ComplianceMatrix

OUTPUT SCHEMA: {
  dimensions: {
    name: string,
    scores: { claude: number, gpt: number, gemini: number },
    meanScore: number,
    stdDev: number,
    isHighVariance: boolean,
    improvementSuggestion: string | null
  }[],
  overallMeanScore: number,
  highVarianceAreas: string[],
  topImprovements: string[]
}
```

---

## 6. Adapter Interfaces & Stub Implementations

```typescript
// src/adapters/meetminds/interface.ts

export interface IMeetMindsAdapter {
  getTranscript(meetingId: string): Promise<MeetMindsOutput>
  listMeetings(params: { clientName?: string, dateRange?: DateRange, meetingType?: string }): Promise<MeetingMeta[]>
  registerWebhook(callbackUrl: string): Promise<void>
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
  decisionMakers: { name: string, role: string, authority: 'decision' | 'influence' | 'unknown' }[]
  actionItems: string[]
  competitiveMentions: string[]
}

export interface MeetingMeta {
  meetingId: string
  date: Date
  participants: string[]
  meetingType: string
  durationMinutes: number
}

// src/adapters/meetminds/stub.ts
export class MeetMindsStubAdapter implements IMeetMindsAdapter {
  async getTranscript(meetingId: string): Promise<MeetMindsOutput> {
    console.warn(`[MeetMindsAdapter] STUB: returning mock transcript for meetingId=${meetingId}`)
    return {
      meetingId,
      transcript: 'This is a stub transcript. Replace MeetMindsStubAdapter with real implementation.',
      metadata: { date: new Date(), participants: ['Client Rep', 'AM'], duration: 60, meetingType: 'discovery' },
      requirements: ['Build a customer portal', 'Mobile-responsive design'],
      painPoints: ['Current process is manual', 'No real-time visibility'],
      budgetSignals: [],
      timelineMentions: ['Go-live by Q3'],
      decisionMakers: [{ name: 'Unknown', role: 'Unknown', authority: 'unknown' }],
      actionItems: ['Send proposal by end of week'],
      competitiveMentions: []
    }
  }

  async listMeetings(params: any): Promise<MeetingMeta[]> {
    console.warn('[MeetMindsAdapter] STUB: returning empty meeting list')
    return []
  }

  async registerWebhook(callbackUrl: string): Promise<void> {
    console.warn(`[MeetMindsAdapter] STUB: webhook registration ignored. URL: ${callbackUrl}`)
  }
}
```

```typescript
// src/adapters/pricing/interface.ts

export interface IPricingAdapter {
  estimate(input: PricingInput): Promise<PricingOutput>
}

export interface PricingInput {
  featureBreakdown: {
    module: string
    features: string[]
    tasks: string[]
    estimationNotes?: string
  }[]
  deliveryModel: 'fixed' | 'tm' | 'hybrid'
  timeline: { durationWeeks: number, phases: { name: string, weeks: number }[] }
  rateConstraints?: { maxBudgetINR?: number, preferredRatePerDay?: number }
  teamCompositionPreferences?: string[]
}

export interface PricingOutput {
  bom: { role: string, effortDays: number, effortMonths: number, ratePerDay: number, totalCostINR: number }[]
  totalCostINR: number
  totalCostUSD?: number
  margin: number
  timeline: { phase: string, durationWeeks: number, startWeek: number }[]
  paymentMilestones: { milestone: string, percentageOfTotal: number, amountINR: number }[]
  assumptions: string[]
  warnings: string[]           // e.g. "Timeline is aggressive for this scope"
  rawLLMOutput: string         // always preserved — never discard
  normalizedAt: Date
}

// src/adapters/pricing/stub.ts
export class PricingStubAdapter implements IPricingAdapter {
  async estimate(input: PricingInput): Promise<PricingOutput> {
    console.warn('[PricingAdapter] STUB: returning mock pricing output')
    const mockTotal = input.featureBreakdown.reduce((acc, m) => acc + m.tasks.length * 50000, 0)
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
        { milestone: 'Project Kickoff', percentageOfTotal: 30, amountINR: mockTotal * 0.3 || 360000 },
        { milestone: 'Mid-point Delivery', percentageOfTotal: 40, amountINR: mockTotal * 0.4 || 480000 },
        { milestone: 'Final Delivery', percentageOfTotal: 30, amountINR: mockTotal * 0.3 || 360000 },
      ],
      assumptions: ['Stub output — replace with real Pricing Tool integration'],
      warnings: ['This is stub data. Do not use for actual proposals.'],
      rawLLMOutput: 'STUB_OUTPUT',
      normalizedAt: new Date()
    }
  }
}
```

```typescript
// src/adapters/knowledge-base/interface.ts

export interface IKnowledgeBaseAdapter {
  searchProjects(query: string, filters?: { domain?: string, techStack?: string[], minOutcomeScore?: number }): Promise<ProjectRecord[]>
  searchCapabilities(query: string, filters?: { serviceArea?: string }): Promise<CapabilityRecord[]>
  searchCaseStudies(query: string, filters?: { domain?: string, capability?: string }): Promise<CaseStudyRecord[]>
  getPositioning(context: ProspectContext): Promise<PositioningOutput>
}

export interface ProjectRecord {
  id: string
  clientName: string      // may be anonymized
  domain: string
  techStack: string[]
  teamSize: number
  durationMonths: number
  outcomes: { metric: string, value: string }[]
  summary: string
  isAnonymized: boolean
}

export interface CapabilityRecord {
  id: string
  serviceArea: string
  capability: string
  description: string
  frameworks: string[]
  differentiators: string[]
}

export interface CaseStudyRecord {
  id: string
  projectId: string
  domain: string
  capability: string
  baseContent: string
  outcomes: { metric: string, before: string, after: string }[]
  isAnonymized: boolean
}

export interface ProspectContext {
  domain: string
  opportunityType: string
  requiredCapabilities: string[]
  framingAngle?: string
}

export interface PositioningOutput {
  positioningStatement: string
  differentiators: string[]
  relevantWedgeOfferings: string[]
}

// src/adapters/knowledge-base/stub.ts
export class KnowledgeBaseStubAdapter implements IKnowledgeBaseAdapter {
  async searchProjects(query: string): Promise<ProjectRecord[]> {
    console.warn('[KnowledgeBaseAdapter] STUB: returning empty project list')
    return []
  }

  async searchCapabilities(query: string): Promise<CapabilityRecord[]> {
    console.warn('[KnowledgeBaseAdapter] STUB: returning placeholder capabilities')
    return [{
      id: 'stub-1',
      serviceArea: 'AI & Automation',
      capability: 'AI-native product development with Olympus multi-agent orchestration',
      description: 'Webknot builds AI-first products using the Olympus agent framework — 12 specialist agents covering design, engineering, QA, DevOps, and delivery coordination.',
      frameworks: ['Olympus', 'OpenClaw'],
      differentiators: ['Speed: sprint-based AI delivery', 'Orchestration-native', 'Full-stack AI capabilities']
    }]
  }

  async searchCaseStudies(query: string): Promise<CaseStudyRecord[]> {
    console.warn('[KnowledgeBaseAdapter] STUB: returning empty case study list')
    return []
  }

  async getPositioning(context: ProspectContext): Promise<PositioningOutput> {
    console.warn('[KnowledgeBaseAdapter] STUB: returning generic positioning')
    return {
      positioningStatement: 'Webknot delivers AI-native products at startup speed with enterprise discipline — powered by Olympus, our proprietary multi-agent delivery system.',
      differentiators: ['AI-native from Day 1', 'Olympus orchestration reduces delivery time by 40%', 'Full-stack: design → engineering → QA → DevOps'],
      relevantWedgeOfferings: ['W1', 'W2']
    }
  }
}
```

---

## 7. WebSocket Event Schema

```typescript
// src/services/websocket/events.ts

// All events are scoped to a room: `engagement:${engagementId}`
// Frontend joins room on engagement page load

export type WebSocketEvent =
  | JobStartedEvent
  | JobProgressEvent
  | JobCompletedEvent
  | JobFailedEvent
  | GateReadyEvent
  | GateApprovedEvent
  | GateRejectedEvent
  | GateReminderEvent
  | ArtifactReadyEvent
  | CascadeDetectedEvent
  | SOWSectionReadyEvent

export interface JobStartedEvent {
  event: 'job_started'
  agentName: string
  jobId: string
  jobDbId: string
  timestamp: string
}

export interface JobProgressEvent {
  event: 'job_progress'
  agentName: string
  jobId: string
  message: string        // human-readable progress update
  percentComplete?: number
}

export interface JobCompletedEvent {
  event: 'job_completed'
  agentName: string
  jobId: string
  outputSummary: string  // 1-2 sentence summary of what was produced
  timestamp: string
}

export interface JobFailedEvent {
  event: 'job_failed'
  agentName: string
  jobId: string
  errorMessage: string   // human-readable, not a stack trace
  options: {
    id: 'retry' | 'proceed' | 'manual'
    label: string
    description: string
  }[]
}

export interface GateReadyEvent {
  event: 'gate_ready'
  gateNumber: 'GATE_1' | 'GATE_2' | 'GATE_3' | 'DEFENSE_GATE'
  complianceMatrix: ComplianceMatrix
  reviewerEmails: string[]
  timestamp: string
}

export interface GateApprovedEvent {
  event: 'gate_approved'
  gateNumber: string
  reviewerName: string
  feedback?: string
  allApproved: boolean   // true if minimum reviewer count met
  timestamp: string
}

export interface GateRejectedEvent {
  event: 'gate_rejected'
  gateNumber: string
  reviewerName: string
  feedback: string
  timestamp: string
}

export interface GateReminderEvent {
  event: 'gate_reminder'
  gateNumber: string
  pendingReviewers: string[]
  hoursWaiting: number
}

export interface ArtifactReadyEvent {
  event: 'artifact_ready'
  collateralType: string
  format: string
  downloadUrl: string    // presigned MinIO URL, 24h TTL
  version: number
  timestamp: string
}

export interface CascadeDetectedEvent {
  event: 'cascade_detected'
  triggerGate: string
  affectedGate: string
  reason: string
  requiresReapproval: boolean
  canOverride: boolean
}

export interface SOWSectionReadyEvent {
  event: 'sow_section_ready'
  section: string
  content: string        // section content as markdown
  sectionIndex: number
  totalSections: number
  requiresConfirmation: true
}
```

---

## 8. Email Templates

All templates use Nodemailer with HTML. Template data injected via mustache-style `{{variable}}`.

```typescript
// src/services/email/templates.ts

export const EMAIL_TEMPLATES = {
  gate_review: {
    subject: '[Presales] Gate {{gateNumber}} ready for review — {{clientName}}',
    body: `
      Hi {{reviewerName}},
      The {{collateralType}} for {{clientName}} is ready for your review at Gate {{gateNumber}}.
      Compliance Score: {{overallScore}}/5
      High-attention areas: {{highVarianceAreas}}
      Review link: {{reviewUrl}}
      Please provide your approval or feedback by {{deadline}}.
    `
  },
  gate_reminder: {
    subject: '[Presales] Reminder: Gate {{gateNumber}} still awaiting review — {{clientName}}',
    body: `
      Hi {{amName}},
      Gate {{gateNumber}} for {{clientName}} has been waiting {{hoursWaiting}} hours.
      Pending reviewers: {{pendingReviewers}}
      Please chase them or assign an alternate reviewer.
      Dashboard: {{dashboardUrl}}
    `
  },
  gate_approved: {
    subject: '[Presales] Gate {{gateNumber}} approved — {{clientName}}',
    body: `
      Hi {{amName}},
      {{reviewerName}} has approved Gate {{gateNumber}} for {{clientName}}.
      {{#feedback}}Feedback: {{feedback}}{{/feedback}}
      {{#allApproved}}All required approvals received. The next stage will begin shortly.{{/allApproved}}
    `
  },
  gate_rejected: {
    subject: '[Presales] Gate {{gateNumber}} — feedback from {{reviewerName}} — {{clientName}}',
    body: `
      Hi {{amName}},
      {{reviewerName}} has requested revisions on Gate {{gateNumber}} for {{clientName}}.
      Feedback: {{feedback}}
      Login to the dashboard to review and action: {{dashboardUrl}}
    `
  },
  sow_approval: {
    subject: '[Presales] SOW ready for final approval — {{clientName}}',
    body: `
      Hi {{recipientName}},
      The Statement of Work for {{clientName}} is ready for your final approval.
      Dual approval required: AM ({{amName}}) + DM ({{dmName}})
      Review link: {{reviewUrl}}
    `
  },
  artifact_ready: {
    subject: '[Presales] Your {{collateralType}} is ready — {{clientName}}',
    body: `
      Hi {{amName}},
      Your {{collateralType}} for {{clientName}} is ready.
      Download: {{downloadUrl}} (valid for 24 hours)
      Version: {{version}}
    `
  },
  agent_failed: {
    subject: '[Presales] Action needed: {{agentName}} failed — {{clientName}}',
    body: `
      Hi {{amName}},
      The {{agentName}} step for {{clientName}} encountered an issue and needs your input.
      Error: {{errorMessage}}
      Options: {{options}}
      Dashboard: {{dashboardUrl}}
    `
  }
}
```

---

## 9. Environment Variable Manifest

```bash
# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/presales     # REQUIRED
REDIS_URL=redis://localhost:6379                                  # REQUIRED

# ─── Storage (MinIO / S3-compatible) ─────────────────────────────────────────
STORAGE_ENDPOINT=http://localhost:9000                           # REQUIRED
STORAGE_ACCESS_KEY=minioadmin                                    # REQUIRED
STORAGE_SECRET_KEY=minioadmin                                    # REQUIRED
STORAGE_BUCKET_UPLOADS=presales-uploads                         # OPTIONAL (default shown)
STORAGE_BUCKET_ARTIFACTS=presales-artifacts                     # OPTIONAL
STORAGE_BUCKET_TEMPLATES=presales-templates                     # OPTIONAL
STORAGE_BUCKET_EXPORTS=presales-exports                         # OPTIONAL
STORAGE_PRESIGNED_URL_TTL_HOURS=24                              # OPTIONAL (default: 24)

# ─── Auth (Google SSO) ───────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=                                                # REQUIRED
GOOGLE_CLIENT_SECRET=                                            # REQUIRED
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback # REQUIRED
JWT_SECRET=                                                      # REQUIRED (min 32 chars)
JWT_EXPIRY=7d                                                    # OPTIONAL (default: 7d)
ALLOWED_GOOGLE_DOMAINS=webknot.in                               # OPTIONAL (restrict to domain)

# ─── LLM Providers ───────────────────────────────────────────────────────────
OPENAI_API_KEY=                                                  # REQUIRED
ANTHROPIC_API_KEY=                                               # REQUIRED
GEMINI_API_KEY=                                                  # REQUIRED

# ─── Email (Nodemailer) ──────────────────────────────────────────────────────
EMAIL_SMTP_HOST=smtp.gmail.com                                   # REQUIRED
EMAIL_SMTP_PORT=587                                              # REQUIRED
EMAIL_SMTP_USER=                                                 # REQUIRED
EMAIL_SMTP_PASS=                                                 # REQUIRED
EMAIL_FROM="Presales Orchestrator <presales@webknot.in>"        # REQUIRED (fully configurable)
EMAIL_ENABLED=true                                               # OPTIONAL (set false for dev)

# ─── Application ─────────────────────────────────────────────────────────────
NODE_ENV=production                                              # REQUIRED
PORT=3000                                                        # OPTIONAL (default: 3000)
FRONTEND_URL=https://presales.webknot.in                        # REQUIRED (CORS + email links)
API_BASE_URL=https://presales.webknot.in/api                    # REQUIRED

# ─── Feature Config ──────────────────────────────────────────────────────────
COMPLIANCE_VARIANCE_THRESHOLD=1.0          # OPTIONAL (stddev threshold for high-variance flag)
GATE_REMINDER_HOURS=24                     # OPTIONAL (hours before reminder fires)
MIN_REVIEWER_COUNT=1                       # OPTIONAL (minimum approvers per gate)
MAX_UPLOAD_SIZE_MB=50                      # OPTIONAL (default: 50)
LLM_OUTPUT_CACHE_TTL_SECONDS=3600         # OPTIONAL (Redis cache TTL for LLM outputs)

# ─── Adapters (toggle real vs stub) ─────────────────────────────────────────
MEETMINDS_ADAPTER=stub                     # OPTIONAL: 'stub' | 'real' (default: stub)
MEETMINDS_API_URL=                         # REQUIRED if MEETMINDS_ADAPTER=real
MEETMINDS_API_KEY=                         # REQUIRED if MEETMINDS_ADAPTER=real
PRICING_ADAPTER=stub                       # OPTIONAL: 'stub' | 'real' (default: stub)
PRICING_API_URL=                           # REQUIRED if PRICING_ADAPTER=real
PRICING_API_KEY=                           # REQUIRED if PRICING_ADAPTER=real
KB_ADAPTER=stub                            # OPTIONAL: 'stub' | 'real' (default: stub)
```

---

## 10. Folder Structure (Complete)

```
presales-orchestrator/
│
├── backend/
│   ├── src/
│   │   ├── index.ts                        ← Express app entry point
│   │   ├── app.ts                          ← Express config, middleware, routes registration
│   │   ├── config/
│   │   │   ├── env.ts                      ← Zod-validated env var loading
│   │   │   ├── redis.ts                    ← Redis connection (BullMQ + cache)
│   │   │   └── storage.ts                  ← MinIO client config
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── engagement.routes.ts
│   │   │   ├── gate.routes.ts
│   │   │   ├── version.routes.ts
│   │   │   ├── upload.routes.ts
│   │   │   ├── job.routes.ts
│   │   │   ├── kb.routes.ts
│   │   │   └── admin.routes.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts          ← JWT validation, req.user injection
│   │   │   ├── rbac.middleware.ts          ← Role-based access control
│   │   │   ├── engagement-access.ts        ← Per-engagement participant check
│   │   │   ├── error.middleware.ts         ← Global error handler
│   │   │   └── upload.middleware.ts        ← Multer config
│   │   │
│   │   ├── agents/
│   │   │   ├── orchestrator/
│   │   │   │   ├── index.ts                ← Orchestrator controller
│   │   │   │   ├── intake-parser.ts        ← Conversational input → structured fields
│   │   │   │   ├── collateral-detector.ts  ← Detect collateral type from message
│   │   │   │   ├── routing.ts              ← Stage → agent invocation map
│   │   │   │   ├── cascade-detector.ts     ← Detect cross-gate impact
│   │   │   │   ├── context-builder.ts      ← Carry-forward context assembly
│   │   │   │   └── state-machine.ts        ← Engagement status transitions
│   │   │   │
│   │   │   ├── research/
│   │   │   │   ├── index.ts                ← Research agent worker
│   │   │   │   ├── search.ts               ← Web search orchestration
│   │   │   │   └── synthesizer.ts          ← LLM synthesis → ResearchBrief
│   │   │   │
│   │   │   ├── context-manager/
│   │   │   │   ├── index.ts                ← Context manager worker
│   │   │   │   ├── retriever.ts            ← KB adapter calls
│   │   │   │   └── positioning-gen.ts      ← Generate "Why Webknot" narrative
│   │   │   │
│   │   │   ├── case-study/
│   │   │   │   ├── index.ts                ← Case study worker
│   │   │   │   ├── matcher.ts              ← Relevance ranking
│   │   │   │   └── writer.ts               ← Tailored case study generation
│   │   │   │
│   │   │   ├── sow-maker/
│   │   │   │   ├── index.ts                ← SOW maker worker
│   │   │   │   ├── section-generator.ts    ← Per-section SOW content generation
│   │   │   │   ├── language-validator.ts   ← Banned words checker
│   │   │   │   └── sections.config.ts      ← Section order + prompts config
│   │   │   │
│   │   │   └── proposal/
│   │   │       ├── index.ts                ← Proposal Maker coordinator
│   │   │       ├── narrative/
│   │   │       │   ├── index.ts            ← Narrative agent worker
│   │   │       │   ├── positioning.ts      ← Positioning + section structure generation
│   │   │       │   ├── content.ts          ← Prose + exec summary generation
│   │   │       │   └── coherence.ts        ← Coherence pass logic
│   │   │       ├── technical/
│   │   │       │   ├── index.ts            ← Technical solution worker
│   │   │       │   ├── architect.ts        ← Architecture + stack generation
│   │   │       │   └── decomposer.ts       ← Feature breakdown for pricing
│   │   │       └── packaging/
│   │   │           ├── index.ts            ← Packaging agent worker
│   │   │           ├── pptx-generator.ts   ← PptxGenJS wrapper
│   │   │           ├── docx-generator.ts   ← docxtemplater wrapper
│   │   │           ├── xlsx-generator.ts   ← exceljs wrapper
│   │   │           └── quality-checker.ts  ← Pre-delivery checks
│   │   │
│   │   ├── adapters/
│   │   │   ├── meetminds/
│   │   │   │   ├── interface.ts
│   │   │   │   ├── stub.ts
│   │   │   │   └── real.ts                 ← Real implementation (empty until MeetMinds++ API ready)
│   │   │   ├── pricing/
│   │   │   │   ├── interface.ts
│   │   │   │   ├── stub.ts
│   │   │   │   ├── real.ts                 ← Real implementation (empty until Pricing Tool API ready)
│   │   │   │   └── normalizer.ts           ← Coerce raw LLM output to PricingOutput schema
│   │   │   ├── knowledge-base/
│   │   │   │   ├── interface.ts
│   │   │   │   ├── stub.ts
│   │   │   │   └── pgvector.ts             ← Real pgvector implementation (empty until KB exists)
│   │   │   └── factory.ts                  ← Reads env vars, returns correct adapter implementations
│   │   │
│   │   ├── jobs/
│   │   │   ├── queues.ts                   ← Queue definitions + job type exports
│   │   │   ├── workers/
│   │   │   │   ├── research.worker.ts
│   │   │   │   ├── context.worker.ts
│   │   │   │   ├── casestudy.worker.ts
│   │   │   │   ├── sow.worker.ts
│   │   │   │   ├── narrative.worker.ts
│   │   │   │   ├── technical.worker.ts
│   │   │   │   ├── packaging.worker.ts
│   │   │   │   ├── pricing.worker.ts
│   │   │   │   ├── scoring.worker.ts
│   │   │   │   ├── email.worker.ts
│   │   │   │   └── diffgen.worker.ts
│   │   │   └── scheduler.ts                ← Gate reminder cron jobs
│   │   │
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   │   ├── router.ts               ← Task type → model tier → API client
│   │   │   │   ├── openai.ts               ← OpenAI API client wrapper
│   │   │   │   ├── anthropic.ts            ← Anthropic API client wrapper
│   │   │   │   ├── gemini.ts               ← Gemini API client wrapper
│   │   │   │   └── scorer.ts               ← Multi-LLM parallel compliance scoring
│   │   │   ├── email/
│   │   │   │   ├── service.ts              ← Nodemailer wrapper
│   │   │   │   └── templates.ts            ← All email template strings
│   │   │   ├── storage/
│   │   │   │   ├── service.ts              ← MinIO operations (put, get, presign, delete)
│   │   │   │   └── document-parser.ts      ← PDF/DOCX/XLSX → text extraction
│   │   │   ├── websocket/
│   │   │   │   ├── server.ts               ← Socket.io setup + room management
│   │   │   │   └── events.ts               ← Typed event emitters
│   │   │   └── audit/
│   │   │       └── logger.ts               ← AuditLog DB writes
│   │   │
│   │   └── types/
│   │       ├── agents.ts                   ← All agent input/output interfaces
│   │       ├── engagements.ts              ← Engagement domain types
│   │       └── express.d.ts                ← Extend Express Request with req.user
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │       └── 0001_initial/
│   │           └── migration.sql           ← Includes pgvector extension + embedding column
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                         ← Router setup, auth guard
│   │   │
│   │   ├── pages/
│   │   │   ├── Login/
│   │   │   │   └── index.tsx               ← Google SSO button
│   │   │   ├── Dashboard/
│   │   │   │   ├── index.tsx               ← Engagement list + status cards
│   │   │   │   └── EngagementCard.tsx
│   │   │   ├── Engagement/
│   │   │   │   ├── index.tsx               ← Engagement detail wrapper
│   │   │   │   ├── IntakeChat.tsx          ← Conversational input UI
│   │   │   │   ├── JobStatusPanel.tsx      ← Live agent job progress (WebSocket)
│   │   │   │   ├── ArtifactReview.tsx      ← Section-by-section artifact review
│   │   │   │   ├── GatePanel.tsx           ← Gate status, compliance matrix, approve/reject
│   │   │   │   ├── VersionHistory.tsx      ← Version timeline + diff view
│   │   │   │   └── SOWWalkthrough.tsx      ← SOW section-by-section confirmation UI
│   │   │   ├── Approvals/
│   │   │   │   └── index.tsx               ← Reviewer's approval view (linked from email)
│   │   │   └── Admin/
│   │   │       ├── Users.tsx
│   │   │       ├── KnowledgeBase.tsx
│   │   │       └── Config.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ComplianceMatrix.tsx        ← Visual scoring matrix with variance flags
│   │   │   ├── AgentJobTimeline.tsx        ← Live job progress with agent names
│   │   │   ├── VersionDiff.tsx             ← Side-by-side version comparison
│   │   │   ├── FileUploadZone.tsx          ← Drag-drop RFP/doc upload
│   │   │   └── CascadeWarningBanner.tsx    ← Cascade impact alert
│   │   │
│   │   ├── hooks/
│   │   │   ├── useEngagement.ts            ← Engagement data + WebSocket subscription
│   │   │   ├── useJobStatus.ts             ← Individual job polling/WebSocket
│   │   │   └── useAuth.ts                  ← Auth state, role checks
│   │   │
│   │   └── services/
│   │       ├── api.ts                      ← Axios instance with base URL + auth header
│   │       ├── engagements.api.ts
│   │       ├── gates.api.ts
│   │       ├── uploads.api.ts
│   │       └── socket.ts                   ← Socket.io client setup
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── nginx/
│   └── presales.conf                       ← Nginx reverse proxy config
│
├── docker-compose.yml                      ← Local dev: Postgres + Redis + MinIO
├── .env.example
└── README.md
```

---

## 11. pgvector Migration Note

The `KnowledgeBaseEntry` embedding column requires a raw SQL migration since Prisma doesn't natively support `vector` type:

```sql
-- prisma/migrations/0001_initial/migration.sql (addition)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "KnowledgeBaseEntry" ADD COLUMN embedding vector(1536);
CREATE INDEX ON "KnowledgeBaseEntry" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

The Prisma schema uses `Unsupported("vector(1536)")` for the column type, and the `pgvector.ts` adapter uses `$queryRaw` for similarity search queries.

---

## Open Questions (LLD Level)

- [ ] Exact Gemini model version to use for compliance scoring — awaiting Gemini API key provisioning
- [ ] Document parsing library preference for PDF extraction: `pdf-parse` vs `pdfjs-dist` — both viable, pick before Sprint 1
- [ ] PptxGenJS vs `officegen` for PPTX generation — PptxGenJS has better maintained API; confirm with Forge
- [ ] Should BullMQ Bull Board (job monitoring UI) be included? Useful for ops visibility but adds a route to secure
- [ ] File size limit for RFP uploads — suggested 50MB in env defaults, confirm with team
- [ ] Should engagement data be soft-deleted or hard-deleted? (Assumed soft-delete / archive for audit integrity)
- [ ] Google Workspace domain restriction for SSO — restrict to `webknot.in` only, or any Google account?
