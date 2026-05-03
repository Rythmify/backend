const db = require('../../src/config/db');
const refreshTokenModel = require('../../src/models/refresh-token.model');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

describe('refresh-token model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a refresh token and returns the inserted row', async () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    db.query.mockResolvedValue({
      rows: [{ id: 'rt1', user_id: 'u1', refresh_token: 'tok', expires_at: expiresAt }],
    });

    const result = await refreshTokenModel.create({
      user_id: 'u1',
      refresh_token: 'tok',
      expires_at: expiresAt,
    });

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO refresh_tokens'), [
      'u1',
      'tok',
      expiresAt,
    ]);
    expect(result).toEqual(expect.objectContaining({ id: 'rt1', user_id: 'u1' }));
  });

  it('returns null when findValid does not find a token', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const result = await refreshTokenModel.findValid('missing-token');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE refresh_token = $1'), [
      'missing-token',
    ]);
    expect(result).toBeNull();
  });

  it('revokes a token and all tokens for a user', async () => {
    db.query.mockResolvedValue({});

    await refreshTokenModel.revoke('tok');
    await refreshTokenModel.revokeAllForUser('u1');

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SET revoked = true'),
      ['tok']
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE user_id = $1'),
      ['u1']
    );
  });

  it('rotates a token atomically when the old token exists', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'old-row-id' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'new-row-id' }] })
      .mockResolvedValueOnce({});

    const result = await refreshTokenModel.rotateToken({
      oldToken: 'old-token',
      userId: 'u1',
      newToken: 'new-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(result).toBe('new-token');
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and returns null when the old token row is not locked', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({});

    const result = await refreshTokenModel.rotateToken({
      oldToken: 'old-token',
      userId: 'u1',
      newToken: 'new-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(result).toBeNull();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and returns null when the insert conflicts', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'old-row-id' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    const result = await refreshTokenModel.rotateToken({
      oldToken: 'old-token',
      userId: 'u1',
      newToken: 'new-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(result).toBeNull();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});