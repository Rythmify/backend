const validators = require('../../src/utils/validators');

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('returns true for valid email', () => {
      expect(validators.isValidEmail('test@example.com')).toBe(true);
    });

    it('returns false for invalid email', () => {
      expect(validators.isValidEmail('invalid-email')).toBe(false);
      expect(validators.isValidEmail('test@')).toBe(false);
      expect(validators.isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('returns true for valid url', () => {
      expect(validators.isValidUrl('http://example.com')).toBe(true);
      expect(validators.isValidUrl('https://example.com/path')).toBe(true);
    });

    it('returns false for invalid url', () => {
      expect(validators.isValidUrl('invalid-url')).toBe(false);
      expect(validators.isValidUrl('')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('returns true for valid password', () => {
      expect(validators.isValidPassword('Password123')).toBe(true);
      expect(validators.isValidPassword('Aa1!@#$%^&*()_+')).toBe(true);
    });

    it('returns false for invalid password', () => {
      expect(validators.isValidPassword('short1A')).toBe(false); // < 8 chars
      expect(validators.isValidPassword('alllowercase1')).toBe(false); // no uppercase
      expect(validators.isValidPassword('ALLUPPERCASE1')).toBe(false); // no lowercase
      expect(validators.isValidPassword('NoNumbersHere')).toBe(false); // no number
    });
  });

  describe('isValidDisplayName', () => {
    it('returns true for valid display name', () => {
      expect(validators.isValidDisplayName('John Doe')).toBe(true);
      expect(validators.isValidDisplayName('A')).toBe(true);
      expect(validators.isValidDisplayName('a'.repeat(50))).toBe(true);
    });

    it('returns false for invalid display name', () => {
      expect(validators.isValidDisplayName('')).toBe(false);
      expect(validators.isValidDisplayName('   ')).toBe(false);
      expect(validators.isValidDisplayName('a'.repeat(51))).toBe(false);
      expect(validators.isValidDisplayName(null)).toBe(false);
      expect(validators.isValidDisplayName(123)).toBe(false);
    });
  });

  describe('isValidDateOfBirth', () => {
    it('returns true for user >= 13 years old', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 14);
      expect(validators.isValidDateOfBirth(pastDate.toISOString())).toBe(true);
    });

    it('returns false for user < 13 years old', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 12);
      expect(validators.isValidDateOfBirth(pastDate.toISOString())).toBe(false);
    });

    it('returns false for invalid date string', () => {
      expect(validators.isValidDateOfBirth('invalid-date')).toBe(false);
    });
  });

  describe('isValidGender', () => {
    // Need to check what GENDER_TYPES are, typically 'male', 'female', 'prefer_not_to_say'
    it('returns true for valid gender', () => {
      // We know it uses Object.values(GENDER_TYPES). Let's mock or just assume default 'male'.
      // If it fails we'll fix it, but assuming 'male' is standard
      expect(validators.isValidGender('male')).toBe(true);
    });

    it('returns false for invalid gender', () => {
      expect(validators.isValidGender('alien')).toBe(false);
    });
  });
});
