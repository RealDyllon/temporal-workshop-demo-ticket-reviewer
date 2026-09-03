import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { pollRecordsOnce } from '../services/poll-records.js';

let shuttingDown = false;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shuttingDown = true;
  });
}

console.log(`Polling the external API every ${config.POLL_INTERVAL_MS}ms`);

while (!shuttingDown) {
  try {
    const count = await pollRecordsOnce();
    if (count > 0) {
      console.log(`Ingested ${count} external record version(s)`);
    }
  } catch (error) {
    console.error('Poll failed; the next interval will retry', error);
  }

  await delay(config.POLL_INTERVAL_MS);
}

await prisma.$disconnect();
