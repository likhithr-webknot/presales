/*
  Warnings:

  - A unique constraint covering the columns `[engagementId,gateNumber,reviewerId]` on the table `GateApproval` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ENGAGEMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CASCADE_DETECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'CONFIG_UPDATED';

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "engagementId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GateApproval_engagementId_gateNumber_reviewerId_key" ON "GateApproval"("engagementId", "gateNumber", "reviewerId");
