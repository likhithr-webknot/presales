-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('HUMAN_EDIT', 'VERIFIER_REJECTION', 'USER_COMMENT');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('CANDIDATE', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FeedbackEvent" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "FeedbackType" NOT NULL,
    "collateralType" "CollateralType" NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "collateralTypes" "CollateralType"[],
    "status" "LessonStatus" NOT NULL DEFAULT 'CANDIDATE',
    "sourceEventIds" TEXT[],
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackEvent_processed_createdAt_idx" ON "FeedbackEvent"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- AddForeignKey
ALTER TABLE "FeedbackEvent" ADD CONSTRAINT "FeedbackEvent_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 8.0.0-rc.34                 │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
