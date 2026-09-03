import { fileURLToPath } from 'node:url';
import { bundleWorkflowCode } from '@temporalio/worker';

const workflowsPath = fileURLToPath(
  new URL('../src/temporal/workflows/index.ts', import.meta.url),
);

await bundleWorkflowCode({ workflowsPath });
console.log('Temporal Workflow bundle compiled successfully.');
