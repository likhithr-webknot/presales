-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('AM', 'DM', 'SALES_HEAD', 'REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EngagementStage" AS ENUM ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('INITIATED', 'RESEARCH_COMPLETE', 'PROPOSAL_IN_PROGRESS', 'UNDER_REVIEW', 'APPROVED', 'DELIVERED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollateralType" AS ENUM ('FIRST_MEETING_DECK', 'POST_DISCOVERY_DECK', 'TECHNICAL_PROPOSAL', 'PROPOSAL_DEFENSE_DECK', 'STATEMENT_OF_WORK', 'COMMERCIAL_ESTIMATION', 'CASE_STUDY_DOCUMENT', 'MARKETING_CONTENT');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('PENDING', 'APPROVED', 'APPROVED_WITH_FEEDBACK', 'REJECTED');

-- CreateEnum
CREATE TYPE "GateNumber" AS ENUM ('GATE_1', 'GATE_2', 'GATE_3', 'DEFENSE_GATE', 'SOW_AM', 'SOW_DM');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('ORCHESTRATOR', 'SECONDARY_RESEARCH', 'CONTEXT_MANAGER', 'MEETMINDS_ADAPTER', 'PRICING_ADAPTER', 'CASE_STUDY_MAKER', 'SOW_MAKER', 'PROPOSAL_MAKER', 'NARRATIVE_AGENT', 'TECHNICAL_SOLUTION', 'PACKAGING_AGENT', 'COMPLIANCE_SCORER');

-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('RFP', 'REQUIREMENT_DOC', 'QA_SPREADSHEET', 'PREVIOUS_PROPOSAL', 'CLIENT_BRIEF', 'SOW_TEMPLATE', 'OTHER');

-- CreateEnum
CREATE TYPE "KBEntryType" AS ENUM ('PROJECT', 'CAPABILITY', 'CASE_STUDY', 'TEAM_PROFILE', 'DIFFERENTIATOR', 'WEDGE_OFFERING', 'MARKETING_ASSET');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ENGAGEMENT_CREATED', 'STAGE_ADVANCED', 'AGENT_INVOKED', 'AGENT_COMPLETED', 'AGENT_FAILED', 'GATE_SENT_FOR_REVIEW', 'GATE_APPROVED', 'GATE_REJECTED', 'GATE_OVERRIDDEN', 'REVISION_REQUESTED', 'VERSION_CREATED', 'ARTIFACT_DOWNLOADED', 'SOW_SECTION_CONFIRMED', 'OVERRIDE_APPLIED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "googleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "opportunityContext" TEXT,
    "contactDetails" JSONB,
    "stage" "EngagementStage" NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'INITIATED',
    "collateralType" "CollateralType" NOT NULL,
    "currentBlocker" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementVersion" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "triggeredByUserId" TEXT,
    "changeReason" TEXT,
    "diffSummary" TEXT,
    "artifacts" JSONB NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementReviewer" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "gateNumber" INTEGER,
    "isAlternate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementReviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateApproval" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "gateNumber" "GateNumber" NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "GateStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "complianceMatrix" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GateApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "agentName" "AgentName" NOT NULL,
    "bullmqJobId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "parentJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementUpload" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "uploadType" "UploadType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "parsedContent" JSONB,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseEntry" (
    "id" TEXT NOT NULL,
    "type" "KBEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementVersion_engagementId_version_key" ON "EngagementVersion"("engagementId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementVersion" ADD CONSTRAINT "EngagementVersion_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementReviewer" ADD CONSTRAINT "EngagementReviewer_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateApproval" ADD CONSTRAINT "GateApproval_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateApproval" ADD CONSTRAINT "GateApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementUpload" ADD CONSTRAINT "EngagementUpload_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
