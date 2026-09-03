import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import type {
  ExternalRecord,
  ExternalRecordPage,
  ExternalReviewOutcome,
  StoredExternalReviewOutcome,
} from '../contracts/external-api.js';
import type { JsonObject } from '../contracts/json.js';

export const app = Fastify({ logger: true });
const records: ExternalRecord[] = [];
const outcomes = new Map<string, StoredExternalReviewOutcome>();
let sequence = 0;

const newRecordSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

const outcomeSchema = z
  .object({
    idempotencyKey: z.string().min(1),
    workflowId: z.string().min(1),
    externalVersion: z.number().int().positive(),
    reviewedByUserId: z.string().min(1),
    decision: z.enum(['ACCEPT', 'REJECT']),
    rejectionMode: z.enum(['FINAL', 'ALLOW_RESUBMISSION']).optional(),
    notes: z.string().max(2_000).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'REJECT' && value.rejectionMode === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionMode'],
        message: 'rejectionMode is required when decision is REJECT',
      });
    }

    if (value.decision === 'ACCEPT' && value.rejectionMode !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionMode'],
        message: 'rejectionMode is only valid when decision is REJECT',
      });
    }
  });

app.get('/health', async () => ({ ok: true, service: 'mock-external-api' }));

app.get<{ Querystring: { after?: string } }>('/records', async (request): Promise<ExternalRecordPage> => {
  const after = z.coerce.number().int().nonnegative().default(0).parse(request.query.after);
  const page = records.filter((record) => record.sequence > after).slice(0, 100);

  return {
    records: page,
    nextSequence: page.at(-1)?.sequence ?? after,
  };
});

app.post('/admin/records', async (request, reply) => {
  const parsed = newRecordSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const id = parsed.data.id ?? `record-${String(sequence + 1).padStart(3, '0')}`;
  const record = appendRecord(id, parsed.data.title, parsed.data.payload as JsonObject);

  return reply.status(201).send(record);
});

app.post<{ Params: { externalId: string } }>(
  '/records/:externalId/review-outcomes',
  async (request, reply) => {
    const parsed = outcomeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = outcomes.get(parsed.data.idempotencyKey);
    if (existing !== undefined) {
      const sameRequest =
        existing.externalId === request.params.externalId &&
        existing.workflowId === parsed.data.workflowId &&
        existing.decision === parsed.data.decision;

      if (!sameRequest) {
        return reply.status(409).send({ error: 'Idempotency key was reused for a different outcome' });
      }

      return existing;
    }

    const outcome: StoredExternalReviewOutcome = {
      ...toOutcome(parsed.data),
      externalId: request.params.externalId,
      receivedAt: new Date().toISOString(),
    };

    outcomes.set(outcome.idempotencyKey, outcome);
    return reply.status(201).send(outcome);
  },
);

app.get('/admin/outcomes', async () => ({ outcomes: [...outcomes.values()] }));

appendRecord('invoice-1001', 'Invoice 1001', { amount: 1250, currency: 'SGD', supplier: 'Acme Pte Ltd' });
appendRecord('invoice-1002', 'Invoice 1002', { amount: 860, currency: 'SGD', supplier: 'Orbit Pte Ltd' });

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await app.listen({ host: '127.0.0.1', port: config.EXTERNAL_API_PORT });
}

function appendRecord(id: string, title: string, payload: JsonObject): ExternalRecord {
  const priorVersion = records
    .filter((record) => record.id === id)
    .reduce((highest, record) => Math.max(highest, record.version), 0);

  const record: ExternalRecord = {
    id,
    version: priorVersion + 1,
    sequence: ++sequence,
    title,
    payload,
    updatedAt: new Date().toISOString(),
  };

  records.push(record);
  return record;
}

function toOutcome(value: z.infer<typeof outcomeSchema>): ExternalReviewOutcome {
  return {
    idempotencyKey: value.idempotencyKey,
    workflowId: value.workflowId,
    externalVersion: value.externalVersion,
    reviewedByUserId: value.reviewedByUserId,
    decision: value.decision,
    ...(value.rejectionMode === undefined ? {} : { rejectionMode: value.rejectionMode }),
    ...(value.notes === undefined ? {} : { notes: value.notes }),
  };
}
