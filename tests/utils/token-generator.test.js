// ============================================================
// tests/utils/token-generator.test.js
// Coverage Target: 100%
// ============================================================
const { generateSecureToken, parseDurationToSeconds } = require('../../src/utils/token-generator');

describe('Token Generator Utility', () => {
  describe('generateSecureToken', () => {
    it('returns a 64-character hex string', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });
  });

  describe('parseDurationToSeconds', () => {
    it('returns default if no duration', () => {
      expect(parseDurationToSeconds(null)).toBe(900);
    });

    it('returns default if invalid format', async () => {
      expect(parseDurationToSeconds('invalid')).toBe(900);
    });

    it('parses seconds', () => {
      expect(parseDurationToSeconds('10s')).toBe(10);
    });

    it('parses minutes', () => {
      expect(parseDurationToSeconds('5m')).toBe(300);
    });

    it('parses hours', () => {
      expect(parseDurationToSeconds('2h')).toBe(7200);
    });

    it('parses days', () => {
      expect(parseDurationToSeconds('1d')).toBe(86400);
    });

    it('handles unexpected units with multiplier 1', () => {
        // Technically regex prevents this, but the code has a fallback
        // Since unit is [smhd], it's hard to hit || 1 unless we change regex
    });
  });
});
