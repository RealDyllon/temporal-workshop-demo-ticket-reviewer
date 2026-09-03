import type { JsonObject } from './json.js';

export const reviewStatuses = [
  'RECEIVED',
  'READY_FOR_REVIEW',
  'ASSIGNED',
  'REVIEWED',
  'ACCEPTED',
  'REJECTED_FINAL',
  'REJECTED_ALLOW_RESUBMISSION',
] as const;

export type ReviewStatus = (typeof reviewStatuses)[number];
export type ReviewDecision = 'ACCEPT' | 'REJECT';
export type RejectionMode = 'FINAL' | 'ALLOW_RESUBMISSION';

export interface ReviewWorkflowInput {
  externalId: string;
  externalVersion: number;
  title: string;
  payload: JsonObject;
  sourceUpdatedAt: string;
}

export interface AssignReviewInput {
  userId: string;
}

export interface SubmitReviewInput {
  userId: string;
  decision: ReviewDecision;
  rejectionMode?: RejectionMode;
  notes?: string;
}

export interface ReviewWorkflowState {
  workflowId: string;
  reviewCaseId?: string;
  externalId: string;
  externalVersion: number;
  status: ReviewStatus;
  assignedUserId?: string;
  review?: SubmitReviewInput;
}

export interface ReviewWorkflowResult {
  workflowId: string;
  reviewCaseId: string;
  finalStatus: 'ACCEPTED' | 'REJECTED_FINAL' | 'REJECTED_ALLOW_RESUBMISSION';
}
