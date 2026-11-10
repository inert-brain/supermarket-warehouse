import { createServer } from 'node:http';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { loadConfig } from './config';
import { createHandler } from './http';
import { createProductLookup } from './products';
import { Pool } from 'pg';
import { LocationService } from './location';

const config = loadConfig(process.env);
const app = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const dataConnect = getDataConnect({ serviceId: config.serviceId, location: config.location }, app);
// DATABASE_URL is optional so the existing receiving endpoint can run independently.
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000, query_timeout: 15000 }) : undefined;
const location = pool ? new LocationService(pool, config.storeTimezone) : undefined;
const server = createServer(createHandler(createProductLookup(dataConnect), config.storeTimezone, undefined, location));
server.listen(config.port, config.host, () => {
  console.log(`Receiving validation listening on ${config.host}:${config.port}`);
});
