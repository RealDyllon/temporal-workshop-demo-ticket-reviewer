import type { ReviewStatus } from '../../contracts/review.js';
import type {
  AssignReviewInput,
  ReviewWorkflowInput,
  SubmitReviewInput,
} from '../../contracts/review.js';
import { prisma } from '../../db/prisma.js';
import { ExternalApiClient } from '../../services/external-api.client.js';

interface WorkflowReference {
  workflowId: string;
  reviewCaseId: string;
}

export interface ReceiveDataActivityInput extends ReviewWorkflowInput {
  workflowId: string;
}

export interface AssignmentActivityInput extends WorkflowReference {
  assignment: AssignReviewInput;
}

export interface ReviewedActivityInput extends WorkflowReference {
  review: SubmitReviewInput;
}

export interface SendOutcomeActivityInput extends ReviewedActivityInput {
  externalId: string;
  externalVersion: number;
}

export async function receiveData(input: ReceiveDataActivityInput): Promise<{ reviewCaseId: string }> {
  const reviewCase = await prisma.reviewCase.upsert({
    where: { workflowId: input.workflowId },
    create: {
      workflowId: input.workflowId,
      externalId: input.externalId,
      externalVersion: input.externalVersion,
      title: input.title,
      payload: input.payload,
      sourceUpdatedAt: new Date(input.sourceUpdatedAt),
      status: 'RECEIVED',
    },
    update: {
      title: input.title,
      payload: input.payload,
      sourceUpdatedAt: new Date(input.sourceUpdatedAt),
    },
    select: { id: true },
  });

  return { reviewCaseId: reviewCase.id };
}

export async function markReadyForReview({ reviewCaseId }: WorkflowReference): Promise<void> {
  await setStatus(reviewCaseId, 'READY_FOR_REVIEW');
}

export async function markAssigned(input: AssignmentActivityInput): Promise<void> {
  await prisma.reviewCase.update({
    where: { id: input.reviewCaseId },
    data: {
      status: 'ASSIGNED',
      assignedUserId: input.assignment.userId,
    },
  });
}

export async function markReviewed(input: ReviewedActivityInput): Promise<void> {
  await prisma.reviewCase.update({
    where: { id: input.reviewCaseId },
    data: {
      status: 'REVIEWED',
      reviewedByUserId: input.review.userId,
      decision: input.review.decision,
      rejectionMode: input.review.rejectionMode ?? null,
      reviewNotes: input.review.notes ?? null,
    },
  });
}

export async function sendReviewOutcome(input: SendOutcomeActivityInput): Promise<{
  finalStatus: 'ACCEPTED' | 'REJECTED_FINAL' | 'REJECTED_ALLOW_RESUBMISSION';
}> {
  const finalStatus = getFinalStatus(input.review);
  const externalApi = new ExternalApiClient();

  await externalApi.sendReviewOutcome(input.externalId, {
    idempotencyKey: input.workflowId,
    workflowId: input.workflowId,
    externalVersion: input.externalVersion,
    reviewedByUserId: input.review.userId,
    decision: input.review.decision,
    ...(input.review.rejectionMode === undefined
      ? {}
      : { rejectionMode: input.review.rejectionMode }),
    ...(input.review.notes === undefined ? {} : { notes: input.review.notes }),
  });

  await prisma.reviewCase.update({
    where: { id: input.reviewCaseId },
    data: {
      status: finalStatus,
      outcomeDeliveredAt: new Date(),
    },
  });

  return { finalStatus };
}

function getFinalStatus(
  review: SubmitReviewInput,
): 'ACCEPTED' | 'REJECTED_FINAL' | 'REJECTED_ALLOW_RESUBMISSION' {
  if (review.decision === 'ACCEPT') {
    return 'ACCEPTED';
  }

  if (review.rejectionMode === 'ALLOW_RESUBMISSION') {
    return 'REJECTED_ALLOW_RESUBMISSION';
  }

  return 'REJECTED_FINAL';
}

async function setStatus(reviewCaseId: string, status: ReviewStatus): Promise<void> {
  await prisma.reviewCase.update({
    where: { id: reviewCaseId },
    data: { status },
  });
}
