CREATE TYPE "ReviewStatus" AS ENUM (
  'RECEIVED',
  'READY_FOR_REVIEW',
  'ASSIGNED',
  'REVIEWED',
  'ACCEPTED',
  'REJECTED_FINAL',
  'REJECTED_ALLOW_RESUBMISSION'
);

CREATE TYPE "ReviewDecision" AS ENUM ('ACCEPT', 'REJECT');

CREATE TYPE "RejectionMode" AS ENUM ('FINAL', 'ALLOW_RESUBMISSION');

CREATE TABLE "ReviewCase" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalVersion" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "status" "ReviewStatus" NOT NULL,
  "assignedUserId" TEXT,
  "reviewedByUserId" TEXT,
  "decision" "ReviewDecision",
  "rejectionMode" "RejectionMode",
  "reviewNotes" TEXT,
  "outcomeDeliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReviewCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollCursor" (
  "source" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PollCursor_pkey" PRIMARY KEY ("source")
);

CREATE UNIQUE INDEX "ReviewCase_workflowId_key" ON "ReviewCase"("workflowId");
CREATE UNIQUE INDEX "ReviewCase_externalId_externalVersion_key" ON "ReviewCase"("externalId", "externalVersion");
CREATE INDEX "ReviewCase_status_idx" ON "ReviewCase"("status");
CREATE INDEX "ReviewCase_assignedUserId_status_idx" ON "ReviewCase"("assignedUserId", "status");
