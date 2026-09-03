import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import * as activities from '../temporal/activities/review.activities.js';

const connection = await NativeConnection.connect({
  address: config.TEMPORAL_ADDRESS,
});

try {
  const worker = await Worker.create({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
    workflowsPath: fileURLToPath(new URL('../temporal/workflows/index.ts', import.meta.url)),
    activities,
  });

  console.log(`Temporal Worker polling task queue: ${config.TEMPORAL_TASK_QUEUE}`);
  await worker.run();
} finally {
  await prisma.$disconnect();
  await connection.close();
}
