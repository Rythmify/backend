const env = require('../../src/config/env');

describe('Redis Config', () => {
  let redisConfig;
  let mockCreateClient;
  let mockClientInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockClientInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      isOpen: false,
    };

    mockCreateClient = jest.fn().mockReturnValue(mockClientInstance);

    jest.mock('redis', () => ({
      createClient: mockCreateClient,
    }));

    // Mock env
    jest.mock('../../src/config/env', () => ({
      REDIS_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379'
    }));

    redisConfig = require('../../src/config/redis');
  });

  it('returns null if REDIS_ENABLED is not true', async () => {
    require('../../src/config/env').REDIS_ENABLED = 'false';
    const client = await redisConfig.getRedisClient();
    expect(client).toBeNull();
  });

  it('returns null if redis module fails to load', async () => {
    jest.mock('redis', () => {
      throw new Error('Module not found');
    });
    
    // We have to re-require because we just updated the mock and redisConfig already evaluated loadRedisModule ? Wait, redisConfig evaluates loadRedisModule lazily.
    // Let's test this by re-requiring.
    jest.resetModules();
    jest.mock('../../src/config/env', () => ({ REDIS_ENABLED: 'true' }));
    jest.doMock('redis', () => { throw new Error('fail'); });
    const localRedisConfig = require('../../src/config/redis');
    
    const client = await localRedisConfig.getRedisClient();
    expect(client).toBeNull();
    
    // And second time should return null without throwing
    const client2 = await localRedisConfig.getRedisClient();
    expect(client2).toBeNull();
  });

  it('creates and connects client successfully', async () => {
    mockClientInstance.connect.mockImplementation(async () => {
      mockClientInstance.isOpen = true;
    });
    
    const client = await redisConfig.getRedisClient();
    expect(client).toBe(mockClientInstance);
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockClientInstance.connect).toHaveBeenCalled();
  });

  it('returns existing open client', async () => {
    mockClientInstance.connect.mockImplementation(async () => {
      mockClientInstance.isOpen = true;
    });
    
    const client1 = await redisConfig.getRedisClient();
    const client2 = await redisConfig.getRedisClient();
    
    expect(client1).toBe(client2);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockClientInstance.connect).toHaveBeenCalledTimes(1);
  });

  it('handles concurrent connection requests using promise', async () => {
    mockClientInstance.connect.mockImplementation(async () => {
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 10));
      mockClientInstance.isOpen = true;
    });

    const [client1, client2] = await Promise.all([
      redisConfig.getRedisClient(),
      redisConfig.getRedisClient()
    ]);

    expect(client1).toBe(mockClientInstance);
    expect(client2).toBe(mockClientInstance);
    expect(mockClientInstance.connect).toHaveBeenCalledTimes(1);
  });

  it('handles connection failure', async () => {
    mockClientInstance.connect.mockRejectedValue(new Error('connection failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const client = await redisConfig.getRedisClient();
    expect(client).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('[cache] Redis connection failed:', 'connection failed');

    // Second failure shouldn't log again
    const client2 = await redisConfig.getRedisClient();
    expect(client2).toBeNull();
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('handles redis client error event', async () => {
    // We need to trigger the 'error' event handler that is registered in createRedisClient
    mockClientInstance.connect.mockImplementation(async () => {
      mockClientInstance.isOpen = true;
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await redisConfig.getRedisClient();
    
    // Find the error handler
    const errorHandler = mockClientInstance.on.mock.calls.find(call => call[0] === 'error')[1];
    
    // Trigger it
    errorHandler(new Error('some client error'));
    expect(consoleSpy).toHaveBeenCalledWith('[cache] Redis client error:', 'some client error');
    
    // Trigger again, shouldn't log
    errorHandler(new Error('some client error 2'));
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});
