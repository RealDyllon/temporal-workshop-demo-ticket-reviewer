import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/apps/mock-external-api.js';
import type { ExternalRecordPage } from '../src/contracts/external-api.js';

afterAll(async () => app.close());

describe('mock external API', () => {
  it('polls by cursor and creates a new version for an existing ID', async () => {
    const initialResponse = await app.inject({ method: 'GET', url: '/records?after=0' });
    expect(initialResponse.statusCode).toBe(200);

    const initial = initialResponse.json<ExternalRecordPage>();
    expect(initial.records).toHaveLength(2);
    expect(initial.nextSequence).toBe(2);

    const updateResponse = await app.inject({
      method: 'POST',
      url: '/admin/records',
      payload: {
        id: 'invoice-1001',
        title: 'Invoice 1001 corrected',
        payload: { supplier: 'Acme Holdings Pte Ltd' },
      },
    });
    expect(updateResponse.statusCode).toBe(201);
    expect(updateResponse.json()).toMatchObject({ id: 'invoice-1001', version: 2, sequence: 3 });

    const nextResponse = await app.inject({ method: 'GET', url: '/records?after=2' });
    const next = nextResponse.json<ExternalRecordPage>();
    expect(next.records).toHaveLength(1);
    expect(next.records[0]).toMatchObject({ id: 'invoice-1001', version: 2, sequence: 3 });
  });

  it('deduplicates outcome delivery by idempotency key', async () => {
    const payload = {
      idempotencyKey: 'review-invoice-1001-v2',
      workflowId: 'review-invoice-1001-v2',
      externalVersion: 2,
      reviewedByUserId: 'alice',
      decision: 'ACCEPT',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/records/invoice-1001/review-outcomes',
      payload,
    });
    const retry = await app.inject({
      method: 'POST',
      url: '/records/invoice-1001/review-outcomes',
      payload,
    });

    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);

    const outcomes = await app.inject({ method: 'GET', url: '/admin/outcomes' });
    expect(outcomes.json<{ outcomes: unknown[] }>().outcomes).toHaveLength(1);
  });
});
