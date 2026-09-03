import type { JsonObject } from './json.js';

export interface ExternalRecord {
  id: string;
  version: number;
  sequence: number;
  title: string;
  payload: JsonObject;
  updatedAt: string;
}

export interface ExternalRecordPage {
  records: ExternalRecord[];
  nextSequence: number;
}

export interface ExternalReviewOutcome {
  idempotencyKey: string;
  workflowId: string;
  externalVersion: number;
  reviewedByUserId: string;
  decision: 'ACCEPT' | 'REJECT';
  rejectionMode?: 'FINAL' | 'ALLOW_RESUBMISSION';
  notes?: string;
}

export interface StoredExternalReviewOutcome extends ExternalReviewOutcome {
  externalId: string;
  receivedAt: string;
}
