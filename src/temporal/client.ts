import { Client, Connection } from '@temporalio/client';
import { config } from '../config.js';

let clientPromise: Promise<Client> | undefined;

export function getTemporalClient(): Promise<Client> {
  clientPromise ??= Connection.connect({ address: config.TEMPORAL_ADDRESS }).then(
    (connection) =>
      new Client({
        connection,
        namespace: config.TEMPORAL_NAMESPACE,
      }),
  );

  return clientPromise;
}
