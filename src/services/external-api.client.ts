import type {
  ExternalRecordPage,
  ExternalReviewOutcome,
  StoredExternalReviewOutcome,
} from '../contracts/external-api.js';
import { config } from '../config.js';

export class ExternalApiClient {
  constructor(private readonly baseUrl = config.EXTERNAL_API_BASE_URL) {}

  async getRecords(afterSequence: number): Promise<ExternalRecordPage> {
    const url = new URL('/records', this.baseUrl);
    url.searchParams.set('after', String(afterSequence));

    return requestJson<ExternalRecordPage>(url, { method: 'GET' });
  }

  async sendReviewOutcome(
    externalId: string,
    outcome: ExternalReviewOutcome,
  ): Promise<StoredExternalReviewOutcome> {
    const url = new URL(`/records/${encodeURIComponent(externalId)}/review-outcomes`, this.baseUrl);

    return requestJson<StoredExternalReviewOutcome>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(outcome),
    });
  }
}

async function requestJson<T>(url: URL, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`External API ${init.method ?? 'GET'} ${url.pathname} failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}
