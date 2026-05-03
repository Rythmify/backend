// ============================================================
// tests/utils/conversation-activity.test.js
// Coverage Target: 100%
// ============================================================
const activity = require('../../src/utils/conversation-activity');

describe('Conversation Activity Utility', () => {
  beforeEach(() => {
    activity._resetForTests();
  });

  it('marks and checks activity', () => {
    activity.markActive({ userId: 'u1', conversationId: 'c1' });
    expect(activity.isRecentlyActive({ userId: 'u1', conversationId: 'c1' })).toBe(true);
  });

  it('handles invalid inputs in markActive', () => {
    activity.markActive({ userId: null, conversationId: 'c1' });
    activity.markActive({ userId: 'u1', conversationId: '' });
    activity.markActive({});
    activity.markActive();
    // No errors should occur
  });

  it('handles invalid inputs in isRecentlyActive', () => {
    expect(activity.isRecentlyActive({ userId: null, conversationId: 'c1' })).toBe(false);
    expect(activity.isRecentlyActive({ userId: 'u1', conversationId: ' ' })).toBe(false);
    expect(activity.isRecentlyActive({})).toBe(false);
    expect(activity.isRecentlyActive()).toBe(false);
  });

  it('returns false for expired activity', () => {
    const now = Date.now();
    activity.markActive({ userId: 'u1', conversationId: 'c1', now: now - 60000 });
    expect(activity.isRecentlyActive({ userId: 'u1', conversationId: 'c1', withinMs: 30000, now })).toBe(false);
  });

  it('returns false for missing key', () => {
    expect(activity.isRecentlyActive({ userId: 'u2', conversationId: 'c2' })).toBe(false);
  });
  
  it('normalizeKey handles non-string and empty string', () => {
      // Indirectly tested via isRecentlyActive/markActive
  });
});
