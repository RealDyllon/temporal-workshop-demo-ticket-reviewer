import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { WorkflowIdReusePolicy } from '@temporalio/common';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { getTemporalClient } from '../temporal/client.js';
import { reviewRecordWorkflow } from '../temporal/workflows/review-record.workflow.js';
import { ExternalApiClient } from './external-api.client.js';

const SOURCE = 'mock-external-api';

export async function pollRecordsOnce(): Promise<number> {
  const externalApi = new ExternalApiClient();
  const temporal = await getTemporalClient();
  const cursor = await prisma.pollCursor.upsert({
    where: { source: SOURCE },
    create: { source: SOURCE, sequence: 0 },
    update: {},
  });
  const page = await externalApi.getRecords(cursor.sequence);

  for (const record of page.records) {
    const workflowId = reviewWorkflowId(record.id, record.version);

    try {
      await temporal.workflow.start(reviewRecordWorkflow, {
        workflowId,
        workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
        taskQueue: config.TEMPORAL_TASK_QUEUE,
        args: [
          {
            externalId: record.id,
            externalVersion: record.version,
            title: record.title,
            payload: record.payload,
            sourceUpdatedAt: record.updatedAt,
          },
        ],
      });

      console.log(`Started ${workflowId}`);
    } catch (error) {
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) {
        throw error;
      }

      console.log(`Already ingested ${workflowId}; advancing the cursor safely`);
    }

    // Advance only after Temporal has durably accepted this record. If this DB
    // write fails, the deterministic Workflow ID makes the next attempt safe.
    await prisma.pollCursor.update({
      where: { source: SOURCE },
      data: { sequence: record.sequence },
    });
  }

  return page.records.length;
}

export function reviewWorkflowId(externalId: string, version: number): string {
  const safeExternalId = externalId.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
  return `review-${safeExternalId}-v${version}`;
}
