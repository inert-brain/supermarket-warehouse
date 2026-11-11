export type ValidationResult = {
  decision: 'READY_FOR_PUTAWAY' | 'EXPIRED' | 'EXPIRY_UNKNOWN';
  product: {
    productID: string;
    description: string | null;
    expiresOn: string | null;
  };
};

export type ReceivingResult = ValidationResult & { registered: boolean };

export type ReceivingClient = {
  lookup(productID: string): Promise<unknown>;
  register(productID: string): Promise<unknown>;
};

// Keep the client calls behind cancellation checks: aborting a wait does not
// cancel Data Connect itself, and a late lookup must never initiate a write.
export async function lookupOrRegister(
  barcode: string, signal: AbortSignal, client: ReceivingClient,
  today: () => string = () => localDate(new Date()),
): Promise<ReceivingResult> {
  if (!barcode.trim()) throw new Error('The barcode is empty. Scan it again.');
  const checkCancelled = () => {
    if (signal.aborted) throw new Error('Lookup cancelled.');
  };
  const read = async () => {
    checkCancelled();
    let data: unknown;
    try {
      data = await waitForQuery(client.lookup(barcode), signal);
    } catch {
      checkCancelled();
      throw new Error('Could not look up the product. Check the connection and Data Connect configuration, then retry.');
    }
    checkCancelled();
    return data;
  };

  const data = await read();
  if (typeof data !== 'object' || data === null || Array.isArray(data) ||
      !Object.prototype.hasOwnProperty.call(data, 'stock') || (data as { stock: unknown }).stock !== null) {
    return { ...interpretStock(data, barcode, today()), registered: false };
  }

  checkCancelled();
  let registration: unknown;
  try {
    registration = await waitForQuery(client.register(barcode), signal);
  } catch {
    checkCancelled();
    throw new Error('Registration could not be confirmed and may have completed. Retry to read the product before attempting registration again.');
  }
  checkCancelled();
  if (typeof registration !== 'object' || registration === null || Array.isArray(registration) ||
      !('registration' in registration) || (registration.registration !== 0 && registration.registration !== 1)) {
    throw new Error('Unexpected registration response. Registration may have completed; retry the lookup.');
  }
  // Even an insert count of 1 is not a product snapshot. A concurrent insert
  // (count 0) must also be read rather than replaced with local defaults.
  const fresh = await read();
  return { ...interpretStock(fresh, barcode, today()), registered: registration.registration === 1 };
}

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

export function localDate(now: Date): string {
  const date = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (!isCalendarDate(date)) throw new Error('Cannot determine the phone date.');
  return date;
}

export function interpretStock(data: unknown, barcode: string, today: string): ValidationResult {
  if (!isCalendarDate(today)) throw new Error('Cannot determine the phone date.');
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
