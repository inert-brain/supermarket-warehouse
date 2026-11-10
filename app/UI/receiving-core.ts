export type ValidationResult = {
  decision: 'READY_FOR_PUTAWAY' | 'EXPIRED' | 'EXPIRY_UNKNOWN';
  product: {
    productID: string;
    description: string | null;
    expiresOn: string | null;
  };
};

export function waitForQuery<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('Lookup cancelled.'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function storeDate(now: Date, timeZone: string): string {
  try {
    if (!timeZone) throw new Error('Missing timezone');
    const parts = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find(part => part.type === type)?.value;
    const date = `${get('year')?.padStart(4, '0')}-${get('month')}-${get('day')}`;
    if (isCalendarDate(date)) return date;
  } catch {
    // Fail closed if the configured timezone or device Intl support is invalid.
  }
  throw new Error('Set a valid EXPO_PUBLIC_STORE_TIMEZONE supported by this device.');
}

export function interpretStock(data: unknown, barcode: string, today: string): ValidationResult {
  if (!isCalendarDate(today)) throw new Error('Cannot determine the store date.');
  if (typeof data !== 'object' || data === null || !('stock' in data)) {
    throw new Error('Unexpected product response. Do not accept the product; retry or contact support.');
  }
  const stock = (data as { stock: unknown }).stock;
  if (stock === null) throw new Error('Product not found. Check the barcode or retry the lookup.');
  if (typeof stock !== 'object' || stock === null) {
    throw new Error('Unexpected product response. Do not accept the product; retry or contact support.');
  }
  const product = stock as Record<string, unknown>;
  if (product.productID !== barcode ||
      (product.description !== null && typeof product.description !== 'string') ||
      (product.expiresOn !== null && typeof product.expiresOn !== 'string')) {
    throw new Error('Unexpected product response. Do not accept the product; retry or contact support.');
  }
  const expiresOn = product.expiresOn as string | null;
  return {
    decision: !isCalendarDate(expiresOn) ? 'EXPIRY_UNKNOWN' : expiresOn < today ? 'EXPIRED' : 'READY_FOR_PUTAWAY',
    product: { productID: barcode, description: product.description as string | null, expiresOn },
  };
}
