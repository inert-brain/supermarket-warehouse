export interface Config {
  projectId: string;
  serviceId: string;
  location: string;
  storeTimezone: string;
  port: number;
  host: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const storeTimezone = env.STORE_TIMEZONE;
  if (!storeTimezone || storeTimezone !== storeTimezone.trim() || /^[+-]/.test(storeTimezone)) {
    throw new Error('STORE_TIMEZONE must be an explicit IANA timezone');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: storeTimezone });
  } catch {
    throw new Error('STORE_TIMEZONE must be an explicit IANA timezone');
  }
  const portText = env.PORT ?? '8080';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  const required = (value: string | undefined, fallback: string, name: string): string => {
    const result = value ?? fallback;
    if (!result.trim() || result !== result.trim()) throw new Error(`${name} must not be empty or padded`);
    return result;
  };
  return {
    projectId: required(env.FIREBASE_PROJECT_ID, 'smart-warehouse-3171e', 'FIREBASE_PROJECT_ID'),
    serviceId: required(env.DATA_CONNECT_SERVICE_ID, 'smart-warehouse-service', 'DATA_CONNECT_SERVICE_ID'),
    location: required(env.DATA_CONNECT_LOCATION, 'asia-southeast1', 'DATA_CONNECT_LOCATION'),
    storeTimezone,
    port: Number(portText),
    host: required(env.HOST, '127.0.0.1', 'HOST'),
  };
}
