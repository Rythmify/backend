const model = require('../src/models/message.model');
const db = require('../src/config/db');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('message.model', () => {
  it('findConversationByPair returns first row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await expect(model.findConversationByPair('u1', 'u2')).resolves.toEqual({ id: 'c1' });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findConversationByPair('u1', 'u2')).resolves.toBeNull();
  });

  it('createConversation returns inserted row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await expect(model.createConversation('u1', 'u2')).resolves.toEqual({ id: 'c1' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('createConversation falls back to existing row on conflict', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'cExisting' }] });

    await expect(model.createConversation('u1', 'u2')).resolves.toEqual({ id: 'cExisting' });
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('createMessage inserts and returns row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });

    await expect(
      model.createMessage({
        conversationId: 'c1',
        senderId: 'u1',
        body: null,
        embedType: undefined,
        embedId: undefined,
      })
    ).resolves.toEqual({ id: 'm1' });

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO messages'), [
      'c1',
      'u1',
      null,
      null,
      null,
    ]);
  });

  it('isBlocked returns boolean', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
    await expect(model.isBlocked('u1', 'u2')).resolves.toBe(true);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.isBlocked('u1', 'u2')).resolves.toBe(false);
  });

  it('getMessagesFromPreference returns preference or default', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ messages_from: 'followers_only' }] });
    await expect(model.getMessagesFromPreference('u1')).resolves.toBe('followers_only');

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.getMessagesFromPreference('u1')).resolves.toBe('everyone');
  });

  it('isFollowing returns boolean', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
    await expect(model.isFollowing('u1', 'u2')).resolves.toBe(true);

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.isFollowing('u1', 'u2')).resolves.toBe(false);
  });

  it('findActiveUserById returns row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
    await expect(model.findActiveUserById('u1')).resolves.toEqual({ id: 'u1' });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findActiveUserById('u1')).resolves.toBeNull();
  });

  it('findConversationsByUserId returns rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await expect(model.findConversationsByUserId('u1', 10, 0)).resolves.toEqual([{ id: 'c1' }]);
  });

  it('countConversationsByUserId returns total', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 9 }] });
    await expect(model.countConversationsByUserId('u1')).resolves.toBe(9);
  });

  it('findConversationById returns row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await expect(model.findConversationById('c1')).resolves.toEqual({ id: 'c1' });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findConversationById('c1')).resolves.toBeNull();
  });

  it('findMessagesByConversationId returns rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    await expect(model.findMessagesByConversationId('c1', 10, 0)).resolves.toEqual([{ id: 'm1' }]);
  });

  it('countMessagesByConversationId returns total', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 4 }] });
    await expect(model.countMessagesByConversationId('c1')).resolves.toBe(4);
  });

  it('findConversationPartner returns row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'u2' }] });
    await expect(model.findConversationPartner('c1', 'u1')).resolves.toEqual({ id: 'u2' });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findConversationPartner('c1', 'u1')).resolves.toBeNull();
  });

  it('countUnreadMessages returns unread count', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ unread_count: 3 }] });
    await expect(model.countUnreadMessages('c1', 'u1')).resolves.toBe(3);
  });

  it('countTotalUnreadMessages returns unread count', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ unread_count: 5 }] });
    await expect(model.countTotalUnreadMessages('u1')).resolves.toBe(5);
  });

  it('findMessageById returns row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    await expect(model.findMessageById('m1', 'c1')).resolves.toEqual({ id: 'm1' });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.findMessageById('m1', 'c1')).resolves.toBeNull();
  });

  it('updateMessageReadState returns updated row or null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'm1', is_read: true }] });
    await expect(model.updateMessageReadState('m1', true)).resolves.toEqual({
      id: 'm1',
      is_read: true,
    });

    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(model.updateMessageReadState('m1', true)).resolves.toBeNull();
  });

  it('deleteMessageById executes delete query', async () => {
    db.query.mockResolvedValueOnce({});
    await model.deleteMessageById('m1');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM messages'), ['m1']);
  });

  it('softDeleteConversation sets deleted_by_a or deleted_by_b and returns row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await expect(model.softDeleteConversation('c1', true)).resolves.toEqual({ id: 'c1' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET deleted_by_a = true'), [
      'c1',
    ]);

    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await expect(model.softDeleteConversation('c1', false)).resolves.toEqual({ id: 'c1' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET deleted_by_b = true'), [
      'c1',
    ]);
  });

  it('restoreConversationForUser sets deleted flag to false for selected side', async () => {
    db.query.mockResolvedValueOnce({});
    await model.restoreConversationForUser('c1', true);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET deleted_by_a = false'), [
      'c1',
    ]);

    db.query.mockResolvedValueOnce({});
    await model.restoreConversationForUser('c1', false);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SET deleted_by_b = false'), [
      'c1',
    ]);
  });
});
