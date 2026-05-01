/**
 * @fileoverview Unit tests for Push Token Model layer
 */

const model = require('../src/models/push-token.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('push-token.model', () => {
  it('registerToken performs upsert', async () => {
    db.query.mockResolvedValueOnce({});

    await model.registerToken('u1', 'tok', 'fcm');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO push_tokens'), [
      'u1',
      'tok',
      'fcm',
    ]);
  });

  it('unregisterToken returns true when row deleted', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });

    await expect(model.unregisterToken('u1', 'tok')).resolves.toBe(true);
  });

  it('unregisterToken returns false when not found', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(model.unregisterToken('u1', 'tok')).resolves.toBe(false);
  });

  it('getTokensByUserId returns rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ token: 'a', platform: 'fcm' }] });

    await expect(model.getTokensByUserId('u1')).resolves.toEqual([{ token: 'a', platform: 'fcm' }]);
  });

  it('getPushPreferencesByUserId returns row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ new_message_push: true }] });
    await expect(model.getPushPreferencesByUserId('u1')).resolves.toEqual({
      new_message_push: true,
    });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.getPushPreferencesByUserId('u1')).resolves.toBeNull();
  });
});
