// ============================================================
// tests/middleware/validate-register.test.js
// ============================================================
const { validateRegister } = require('../../src/middleware/validate-register');
const { error } = require('../../src/utils/api-response');

jest.mock('../../src/utils/api-response', () => ({
  error: jest.fn(),
}));

describe('Validate Register Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = jest.fn();
    error.mockReset();
  });

  it('calls next when payload is valid and normalized fields still pass validation', () => {
    req.body = {
      email: '  Test@Example.com  ',
      password: 'Password123',
      display_name: '  Test User  ',
      gender: 'male',
      date_of_birth: '2000-01-01',
    };

    validateRegister(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('returns all field errors when the body is missing required data', () => {
    validateRegister(req, res, next);

    expect(error).toHaveBeenCalledWith(
      res,
      'VALIDATION_FAILED',
      'Validation failed',
      400,
      expect.arrayContaining([
        { field: 'email', issue: 'Must be a valid email address' },
        {
          field: 'password',
          issue: 'Min 8 characters, must include uppercase, lowercase, and a number',
        },
        { field: 'display_name', issue: 'Must be between 1 and 50 characters' },
        { field: 'gender', issue: 'Must be male or female' },
        {
          field: 'date_of_birth',
          issue: 'Must be a valid date and user must be at least 13 years old',
        },
      ])
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-string display fields and malformed email inputs', () => {
    req.body = {
      email: null,
      password: 'Password123',
      display_name: 123,
      gender: 'male',
      date_of_birth: '2000-01-01',
    };

    validateRegister(req, res, next);

    expect(error).toHaveBeenCalledWith(
      res,
      'VALIDATION_FAILED',
      'Validation failed',
      400,
      expect.arrayContaining([
        { field: 'email', issue: 'Must be a valid email address' },
        { field: 'display_name', issue: 'Must be between 1 and 50 characters' },
      ])
    );
  });
});
