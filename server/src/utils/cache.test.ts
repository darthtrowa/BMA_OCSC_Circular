import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCachedQuery, clearLookupCache } from './cache.js';
import db from '../config/database.js';

vi.mock('../config/database.js', () => ({
  default: {
    query: vi.fn(),
  },
}));

describe('Cache Lookup Tables TTL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLookupCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch from db on first call', async () => {
    (db.query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await getCachedQuery('SELECT * FROM test');
    
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith('SELECT * FROM test', []);
    expect(result).toEqual({ rows: [{ id: 1 }] });
  });

  it('should return cached result on second call within TTL', async () => {
    (db.query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await getCachedQuery('SELECT * FROM test');
    const cachedResult = await getCachedQuery('SELECT * FROM test');
    
    expect(db.query).toHaveBeenCalledTimes(1); // Still 1, didn't call db again
    expect(cachedResult).toEqual({ rows: [{ id: 1 }] });
  });

  it('should fetch from db again if TTL expires', async () => {
    (db.query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });
    (db.query as any).mockResolvedValueOnce({ rows: [{ id: 2 }] });

    await getCachedQuery('SELECT * FROM test');
    expect(db.query).toHaveBeenCalledTimes(1);

    // Fast-forward time by 3601 seconds (TTL is 3600s)
    vi.advanceTimersByTime(3601 * 1000);

    const expiredResult = await getCachedQuery('SELECT * FROM test');
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(expiredResult).toEqual({ rows: [{ id: 2 }] });
  });

  it('should fetch from db again if cache is manually cleared', async () => {
    (db.query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });
    (db.query as any).mockResolvedValueOnce({ rows: [{ id: 2 }] });

    await getCachedQuery('SELECT * FROM test');
    expect(db.query).toHaveBeenCalledTimes(1);

    clearLookupCache();

    const clearedResult = await getCachedQuery('SELECT * FROM test');
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(clearedResult).toEqual({ rows: [{ id: 2 }] });
  });
});
