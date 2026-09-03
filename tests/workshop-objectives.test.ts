import { describe, it } from 'vitest';

describe('reviewRecordWorkflow workshop objectives', () => {
  it.todo('moves a received record to READY_FOR_REVIEW');
  it.todo('waits durably for an assignment Signal');
  it.todo('accepts a review only from the assigned user');
  it.todo('delivers an accepted outcome to the external API');
  it.todo('delivers both final and resubmittable rejection outcomes');
});
