import Fastify from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { getTemporalClient } from '../temporal/client.js';
import {
  assignReviewSignal,
  getReviewStateQuery,
  submitReviewSignal,
} from '../temporal/workflows/review-record.workflow.js';

const app = Fastify({ logger: true });

const idParamsSchema = z.object({ id: z.string().min(1) });
const assignmentSchema = z.object({ userId: z.string().min(1) });
const reviewSchema = z.discriminatedUnion('decision', [
  z.object({
    userId: z.string().min(1),
    decision: z.literal('ACCEPT'),
    notes: z.string().max(2_000).optional(),
  }),
  z.object({
    userId: z.string().min(1),
    decision: z.literal('REJECT'),
    rejectionMode: z.enum(['FINAL', 'ALLOW_RESUBMISSION']),
    notes: z.string().max(2_000).optional(),
  }),
]);

app.get('/', async () => ({
  service: 'review-api',
  routes: [
    'GET /reviews',
    'GET /reviews/:id',
    'GET /reviews/:id/workflow-state',
    'POST /reviews/:id/assign',
    'POST /reviews/:id/review',
  ],
  temporalUi: 'http://localhost:8233',
}));

app.get('/health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true, service: 'review-api' };
});

app.get('/reviews', async (request) => {
  const query = z
    .object({ status: z.enum(['RECEIVED', 'READY_FOR_REVIEW', 'ASSIGNED', 'REVIEWED', 'ACCEPTED', 'REJECTED_FINAL', 'REJECTED_ALLOW_RESUBMISSION']).optional() })
    .parse(request.query);

  return prisma.reviewCase.findMany({
    where: query.status === undefined ? {} : { status: query.status },
    orderBy: { createdAt: 'asc' },
  });
});

app.get<{ Params: { id: string } }>('/reviews/:id', async (request, reply) => {
  const { id } = idParamsSchema.parse(request.params);
  const reviewCase = await prisma.reviewCase.findUnique({ where: { id } });

  if (reviewCase === null) {
    return reply.status(404).send({ error: 'Review case not found' });
  }

  return reviewCase;
});

app.get<{ Params: { id: string } }>('/reviews/:id/workflow-state', async (request, reply) => {
  const reviewCase = await findReviewCase(request.params, reply);
  if (reviewCase === null) return;

  const temporal = await getTemporalClient();
  return temporal.workflow.getHandle(reviewCase.workflowId).query(getReviewStateQuery);
});

app.post<{ Params: { id: string } }>('/reviews/:id/assign', async (request, reply) => {
  const reviewCase = await findReviewCase(request.params, reply);
  if (reviewCase === null) return;

  const assignment = assignmentSchema.parse(request.body);
  const temporal = await getTemporalClient();
  await temporal.workflow.getHandle(reviewCase.workflowId).signal(assignReviewSignal, assignment);

  return reply.status(202).send({ accepted: true, workflowId: reviewCase.workflowId });
});

app.post<{ Params: { id: string } }>('/reviews/:id/review', async (request, reply) => {
  const reviewCase = await findReviewCase(request.params, reply);
  if (reviewCase === null) return;

  const parsedReview = reviewSchema.parse(request.body);
  const review = {
    userId: parsedReview.userId,
    decision: parsedReview.decision,
    ...(parsedReview.decision === 'REJECT'
      ? { rejectionMode: parsedReview.rejectionMode }
      : {}),
    ...(parsedReview.notes === undefined ? {} : { notes: parsedReview.notes }),
  };
  const temporal = await getTemporalClient();
  await temporal.workflow.getHandle(reviewCase.workflowId).signal(submitReviewSignal, review);

  return reply.status(202).send({ accepted: true, workflowId: reviewCase.workflowId });
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    void reply.status(400).send({ error: error.flatten() });
    return;
  }

  app.log.error(error);
  void reply.status(500).send({
    error: error instanceof Error ? error.message : 'Unknown error',
  });
});

await app.listen({ host: '127.0.0.1', port: config.APP_API_PORT });

async function findReviewCase(
  params: unknown,
  reply: { status(code: number): { send(payload: unknown): unknown } },
) {
  const { id } = idParamsSchema.parse(params);
  const reviewCase = await prisma.reviewCase.findUnique({ where: { id } });

  if (reviewCase === null) {
    reply.status(404).send({ error: 'Review case not found' });
    return null;
  }

  return reviewCase;
}
