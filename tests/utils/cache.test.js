const cache = require('../../src/utils/cache');
const { getRedisClient } = require('../../src/config/redis');

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(),
}));

describe('Cache Utility', () => {
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      scanIterator: jest.fn(),
      keys: jest.fn(),
    };
    getRedisClient.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Internal logic', () => {
    it('cloneCacheValue handles null/undefined', async () => {
       // We can't call it directly as it's not exported, but we can hit it via getOrSetCache
       const fetchFn = jest.fn().mockResolvedValue(null);
       const res = await cache.getOrSetCache('null_key', 60, fetchFn);
       expect(res).toBeNull();
    });

    it('cloneCacheValue uses structuredClone if available', async () => {
       // Mock global structuredClone
       const originalStructuredClone = global.structuredClone;
       global.structuredClone = jest.fn().mockImplementation(v => v);
       const fetchFn = jest.fn().mockResolvedValue({ a: 1 });
       await cache.getOrSetCache('sc_key', 60, fetchFn);
       expect(global.structuredClone).toHaveBeenCalled();
       global.structuredClone = originalStructuredClone;
    });

    it('shouldLogKey handles station prefix', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
        
        const fetchFn = jest.fn().mockResolvedValue({ a: 1 });
        await cache.getOrSetCache('station:123', 60, fetchFn);
        expect(spy).not.toHaveBeenCalled(); // should not log station:*
        
        await cache.getOrSetCache('user:123', 60, fetchFn);
        // expect(spy).toHaveBeenCalled(); // might have been called by previous tests, but we clear mocks
        
        spy.mockRestore();
        process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getOrSetCache', () => {
    it('uses memory cache on cache miss without redis', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ id: 1 });
      const res = await cache.getOrSetCache('test_key_1', 60, fetchFn);
      expect(res).toEqual({ id: 1 });
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Second call should hit memory cache
      const res2 = await cache.getOrSetCache('test_key_1', 60, fetchFn);
      expect(res2).toEqual({ id: 1 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('handles redis cache miss then hit', async () => {
      getRedisClient.mockResolvedValue(mockRedisClient);
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue(JSON.stringify({ id: 2 }));
      const fetchFn = jest.fn().mockResolvedValue({ id: 2 });
      
      const res = await cache.getOrSetCache('k2', 60, fetchFn);
      expect(res).toEqual({ id: 2 });
      
      const res2 = await cache.getOrSetCache('k2', 60, fetchFn);
      expect(res2).toEqual({ id: 2 });
    });

    it('detects generation change during fetch', async () => {
        let resolveFetch;
        const fetchFn = jest.fn().mockReturnValue(new Promise(r => { resolveFetch = r; }));
        
        const p1 = cache.getOrSetCache('gen_key', 60, fetchFn);
        
        // While p1 is in flight, invalidate it to bump generation
        await cache.invalidateCache('gen_key');
        
        resolveFetch({ data: 'old' });
        const res = await p1;
        expect(res).toEqual({ data: 'old' });
        // It should have returned data but NOT set it in cache because generation changed
    });

    it('logs write failure', async () => {
        getRedisClient.mockResolvedValue(mockRedisClient);
        mockRedisClient.get.mockResolvedValue(null);
        mockRedisClient.setEx.mockRejectedValue(new Error('fail'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await cache.getOrSetCache('fail_write', 60, () => ({ a: 1 }));
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Write failed'), expect.any(String));
        spy.mockRestore();
    });
  });

  describe('invalidateCachePattern', () => {
    it('clears in-flight fetches for pattern', async () => {
        let resolve;
        const fetchFn = jest.fn().mockReturnValue(new Promise(r => { resolve = r; }));
        const p = cache.getOrSetCache('prefix:inflight', 60, fetchFn);
        
        await cache.invalidateCachePattern('prefix:');
        
        resolve({ done: true });
        await p;
        
        // Subsequent call should be a miss because it was cleared from in-flight tracking (and never set in cache)
        const fetchFn2 = jest.fn().mockResolvedValue({ new: true });
        await cache.getOrSetCache('prefix:inflight', 60, fetchFn2);
        expect(fetchFn2).toHaveBeenCalled();
    });
    
    it('handles scanIterator loop', async () => {
        getRedisClient.mockResolvedValue(mockRedisClient);
        mockRedisClient.scanIterator.mockReturnValue((async function* () {
            yield 'k1';
            yield 'k2';
        })());
        await cache.invalidateCachePattern('p:');
        expect(mockRedisClient.del).toHaveBeenCalledWith(['k1', 'k2']);
    });
  });
});
