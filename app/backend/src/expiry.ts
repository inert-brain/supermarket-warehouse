export type Decision = 'READY_FOR_PUTAWAY' | 'EXPIRED' | 'EXPIRY_UNKNOWN';

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function storeDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  const result = `${get('year')?.padStart(4, '0')}-${get('month')}-${get('day')}`;
  if (!isCalendarDate(result)) throw new Error('Cannot determine store date');
  return result;
}

export function decideExpiry(expiresOn: unknown, today: string): Decision {
  if (!isCalendarDate(today)) throw new Error('Invalid current store date');
  if (!isCalendarDate(expiresOn)) return 'EXPIRY_UNKNOWN';
  return expiresOn < today ? 'EXPIRED' : 'READY_FOR_PUTAWAY';
}
