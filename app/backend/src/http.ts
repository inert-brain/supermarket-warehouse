import { IncomingMessage, ServerResponse } from 'node:http';
import { decideExpiry, storeDate } from './expiry';
import { ProductLookup } from './products';
import { LocationService, parseCommand } from './location';

const MAX_BODY_BYTES = 8192;

function send(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createHandler(lookup: ProductLookup, timezone: string, clock: () => Date = () => new Date(), location?: LocationService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/location/')) {
      const operation = /^\/location\/operations\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(url.pathname);
      const route = url.pathname === '/location/commands' ? 'command' : url.pathname === '/location/snapshot' ? 'snapshot' : operation ? 'operation' : null;
      if (!route) { send(res, 404, { error: 'NOT_FOUND' }); return; }
      const method = route === 'command' ? 'POST' : 'GET';
      if (req.method !== method) { res.setHeader('Allow', method); send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
      if (!location) { send(res, 503, { error: 'LOCATION_UNAVAILABLE' }); return; }
      try {
        if (route === 'operation') {
          const result = await location.operation(operation![1]);
          send(res, 200, result ?? { operationID: operation![1], status: 'unresolved' });
        } else if (route === 'snapshot') {
          const values = url.searchParams.getAll('productID');
          if (values.length !== 1 || !values[0].trim() || values[0].length > 512 || [...url.searchParams.keys()].some(k => k !== 'productID')) { send(res, 400, { error: 'INVALID_INPUT' }); return; }
          const snapshot = await location.snapshot(values[0]);
          if (!snapshot) { send(res, 404, { error: 'PRODUCT_NOT_FOUND' }); return; }
          send(res, 200, snapshot);
        } else {
          let size = 0;
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += bytes.length;
            if (size > MAX_BODY_BYTES) { send(res, 413, { error: 'BODY_TOO_LARGE' }); return; }
            chunks.push(bytes);
          }
          let body: unknown;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { send(res, 400, { error: 'INVALID_INPUT' }); return; }
          const command = parseCommand(body);
          if (!command) { send(res, 400, { error: 'INVALID_INPUT' }); return; }
          const result = await location.submit(command);
          if (result === 'mismatch') { send(res, 409, { error: 'OPERATION_ID_MISMATCH' }); return; }
          send(res, 200, result);
        }
      } catch {
        send(res, 503, { error: 'LOCATION_UNAVAILABLE', retryable: true });
      }
      return;
    }
    if (req.url !== '/receiving/validate') {
      send(res, 404, { error: 'NOT_FOUND' });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    let body: unknown;
    try {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_BODY_BYTES) {
          send(res, 413, { error: 'BODY_TOO_LARGE' });
          return;
        }
        chunks.push(bytes);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      send(res, 400, { error: 'INVALID_INPUT' });
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !('barcode' in body) || typeof body.barcode !== 'string' || !body.barcode.trim()) {
      send(res, 400, { error: 'INVALID_INPUT' });
      return;
    }
    try {
      const product = await lookup.findByBarcode(body.barcode);
      if (!product) {
        send(res, 404, { error: 'PRODUCT_NOT_FOUND' });
        return;
      }
      send(res, 200, { decision: decideExpiry(product.expiresOn, storeDate(clock(), timezone)), product });
    } catch {
      send(res, 503, { error: 'LOOKUP_UNAVAILABLE' });
    }
  };
}
