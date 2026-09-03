import {
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  workflowInfo,
} from '@temporalio/workflow';
import type {
  AssignReviewInput,
  ReviewWorkflowInput,
  ReviewWorkflowResult,
  ReviewWorkflowState,
  SubmitReviewInput,
} from '../../contracts/review.js';
import type * as activities from '../activities/review.activities.js';

export const getReviewStateQuery = defineQuery<ReviewWorkflowState>('getReviewState');
export const assignReviewSignal = defineSignal<[AssignReviewInput]>('assignReview');
export const submitReviewSignal = defineSignal<[SubmitReviewInput]>('submitReview');

const {
  receiveData,
  markReadyForReview,
  markAssigned,
  markReviewed,
  sendReviewOutcome,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 5,
  },
});

/**
 * The workshop exercise lives here. Everything around it is already wired.
 * Search this file for WORKSHOP TODO and implement the durable state machine.
 */
export async function reviewRecordWorkflow(
  input: ReviewWorkflowInput,
): Promise<ReviewWorkflowResult> {
  const workflowId = workflowInfo().workflowId;
  let assignment: AssignReviewInput | undefined;
  let review: SubmitReviewInput | undefined;
  let state: ReviewWorkflowState = {
    workflowId,
    externalId: input.externalId,
    externalVersion: input.externalVersion,
    status: 'RECEIVED',
  };

  // This Query is provided as a working reference. Queries read Workflow state
  // without adding an Event to Workflow History.
  setHandler(getReviewStateQuery, () => state);

  setHandler(assignReviewSignal, (signalInput) => {
    void signalInput;

    // WORKSHOP TODO 2: Accept an assignment only while READY_FOR_REVIEW.
    // Store signalInput in `assignment` and update `state` to ASSIGNED.
    // Consider what should happen if the same Signal is delivered twice.
  });

  setHandler(submitReviewSignal, (signalInput) => {
    void signalInput;

    // WORKSHOP TODO 4: Accept a review only while ASSIGNED and only from
    // the assigned user. Validate the rejectionMode rules, store the input in
    // `review`, and update `state` to REVIEWED.
  });

  // The receive stage is implemented so the starter app immediately proves
  // the API -> poller -> Temporal -> Activity -> Postgres path is working.
  const { reviewCaseId } = await receiveData({ workflowId, ...input });
  state = { ...state, reviewCaseId };

  // WORKSHOP TODO 1: Call markReadyForReview and move state to
  // READY_FOR_REVIEW. Keep external I/O in the Activity.

  // WORKSHOP TODO 3: This durable wait should unblock after the assignment
  // Signal handler stores an assignment. Then call markAssigned.
  await condition(() => assignment !== undefined);
  if (assignment === undefined) {
    throw new Error('The assignment condition unblocked without an assignment');
  }

  // Call markAssigned here, passing workflowId, reviewCaseId, and assignment.

  // WORKSHOP TODO 5: Wait for a valid review and call markReviewed.
  await condition(() => review !== undefined);
  if (review === undefined) {
    throw new Error('The review condition unblocked without a review');
  }

  // Call markReviewed here, passing workflowId, reviewCaseId, and review.

  // WORKSHOP TODO 6: Call sendReviewOutcome. That Activity posts ACCEPT or
  // REJECT (including FINAL vs ALLOW_RESUBMISSION) to the sibling endpoint.
  // Copy the returned finalStatus into state, then return a Workflow result.

  // This keeps the starter Workflow open until TODO 6 is implemented.
  await condition(() => false);
  throw new Error('Unreachable starter guard');
}

// These references keep the pre-wired Activity names visible to TypeScript
// until participants call all of them in the TODOs above.
void markReadyForReview;
void markAssigned;
void markReviewed;
void sendReviewOutcome;
