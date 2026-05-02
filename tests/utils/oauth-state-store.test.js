// ============================================================
// tests/utils/oauth-state-store.test.js
// Coverage Target: 100%
// ============================================================
const stateStore = require('../../src/utils/oauth-state-store');

describe('OAuth State Store Utility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves and validates state', () => {
    stateStore.saveState('state1');
    expect(stateStore.validateAndDeleteState('state1')).toBe(true);
    expect(stateStore.validateAndDeleteState('state1')).toBe(false); // deleted after use
  });

  it('returns false for non-existent state', () => {
    expect(stateStore.validateAndDeleteState('ghost')).toBe(false);
  });

  it('automatically deletes state after 10 minutes', () => {
    stateStore.saveState('state_to_expire');
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(stateStore.validateAndDeleteState('state_to_expire')).toBe(false);
  });
});
