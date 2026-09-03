import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  TEMPORAL_ADDRESS: z.string().min(1).default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().min(1).default('default'),
  TEMPORAL_TASK_QUEUE: z.string().min(1).default('review-workshop'),
  APP_API_PORT: z.coerce.number().int().positive().default(3000),
  EXTERNAL_API_PORT: z.coerce.number().int().positive().default(4000),
  EXTERNAL_API_BASE_URL: z.url().default('http://localhost:4000'),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
});

export const config = envSchema.parse(process.env);
