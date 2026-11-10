import { createServer } from 'node:http';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { loadConfig } from './config';
import { createHandler } from './http';
import { createProductLookup } from './products';

const config = loadConfig(process.env);
const app = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const dataConnect = getDataConnect({ serviceId: config.serviceId, location: config.location }, app);
const server = createServer(createHandler(createProductLookup(dataConnect), config.storeTimezone));
server.listen(config.port, config.host, () => {
  console.log(`Receiving validation listening on ${config.host}:${config.port}`);
});
