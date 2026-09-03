import { prisma } from '../src/db/prisma.js';

await prisma.pollCursor.upsert({
  where: { source: 'mock-external-api' },
  create: { source: 'mock-external-api', sequence: 0 },
  update: {},
});

await prisma.$disconnect();

console.log('Seeded the poll cursor.');
