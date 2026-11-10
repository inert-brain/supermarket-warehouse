import { IncomingMessage, ServerResponse } from 'node:http';
import { decideExpiry, storeDate } from './expiry';
import { ProductLookup } from './products';

const MAX_BODY_BYTES = 8192;

function send(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createHandler(lookup: ProductLookup, timezone: string, clock: () => Date = () => new Date()) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
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
