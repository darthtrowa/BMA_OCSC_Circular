import db from '../config/database.js';

interface CacheItem {
  data: any;
  expiry: number;
}

const lookupCache = new Map<string, CacheItem>();
const TTL_MS = 3600 * 1000;

export async function getCachedQuery(query: string, params: any[] = []): Promise<any> {
  const key = query + JSON.stringify(params);
  const now = Date.now();
  const cached = lookupCache.get(key);
  
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  
  const result = await db.query(query, params);
  lookupCache.set(key, { data: result, expiry: now + TTL_MS });
  return result;
}

export function clearLookupCache(): void {
  lookupCache.clear();
}
