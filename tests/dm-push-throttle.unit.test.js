const throttle = require('../src/utils/dm-push-throttle');

describe('dm-push-throttle', () => {
  beforeEach(() => throttle._resetForTests());

  it('is not throttled before any push is sent', () => {
    expect(
      throttle.isThrottled({ recipientId: 'u1', conversationId: 'c1', withinMs: 60_000, now: 1000 })
    ).toBe(false);
  });

  it('throttles within window after markSent', () => {
    throttle.markSent({ recipientId: 'u1', conversationId: 'c1', now: 1000 });

    expect(
      throttle.isThrottled({ recipientId: 'u1', conversationId: 'c1', withinMs: 60_000, now: 2000 })
    ).toBe(true);
  });

  it('does not throttle after window passes', () => {
    throttle.markSent({ recipientId: 'u1', conversationId: 'c1', now: 1000 });

    expect(
      throttle.isThrottled({ recipientId: 'u1', conversationId: 'c1', withinMs: 60_000, now: 62_000 })
    ).toBe(false);
  });

  it('does not throttle when ids are missing/invalid', () => {
    expect(throttle.isThrottled()).toBe(false);
    expect(throttle.isThrottled({ recipientId: null, conversationId: 'c1' })).toBe(false);
    expect(throttle.isThrottled({ recipientId: 'u1', conversationId: null })).toBe(false);
    expect(throttle.isThrottled({ recipientId: 123, conversationId: 'c1' })).toBe(false);
    expect(throttle.isThrottled({ recipientId: 'u1', conversationId: {} })).toBe(false);
    expect(throttle.isThrottled({ recipientId: '   ', conversationId: 'c1' })).toBe(false);
    expect(throttle.isThrottled({ recipientId: 'u1', conversationId: '   ' })).toBe(false);
  });

  it('ignores markSent when ids are invalid (no throw)', () => {
    throttle.markSent();
    throttle.markSent({ recipientId: null, conversationId: 'c1' });
    throttle.markSent({ recipientId: 'u1', conversationId: null });
    throttle.markSent({ recipientId: '   ', conversationId: 'c1' });
    throttle.markSent({ recipientId: 'u1', conversationId: '   ' });

    expect(throttle.isThrottled({ recipientId: 'u1', conversationId: 'c1' })).toBe(false);
  });

  it('trims ids so whitespace does not bypass throttling', () => {
    throttle.markSent({ recipientId: ' u1 ', conversationId: ' c1 ', now: 1000 });

    expect(
      throttle.isThrottled({ recipientId: 'u1', conversationId: 'c1', withinMs: 60_000, now: 2000 })
    ).toBe(true);
  });

  it('throttles per recipient+conversation key (different conversation not throttled)', () => {
    throttle.markSent({ recipientId: 'u1', conversationId: 'c1', now: 1000 });

    expect(
      throttle.isThrottled({ recipientId: 'u1', conversationId: 'c2', withinMs: 60_000, now: 2000 })
    ).toBe(false);
  });
});
