const {
  validateUuidParam,
  validatePatternParam,
} = require('../../src/middleware/validate-params');

describe('validate-params middleware', () => {
  let req;
  let next;

  beforeEach(() => {
    req = { params: {} };
    next = jest.fn();
  });

  it('normalizes UUID-like params with braces and whitespace', () => {
    req.params.user_id = '  {123e4567-e89b-12d3-a456-426614174000}  ';

    validateUuidParam('user_id')(req, {}, next);

    expect(req.params.user_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects invalid UUID-like params', () => {
    req.params.user_id = 'not-a-uuid';

    validateUuidParam('user_id')(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'user_id must be a valid UUID.',
      })
    );
  });

  it('accepts pattern params that match the regex', () => {
    req.params.slug = 'station-123';

    validatePatternParam('slug', /^station-\d+$/, 'slug is invalid')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects pattern params that do not match the regex', () => {
    req.params.slug = 'playlist';

    validatePatternParam('slug', /^station-\d+$/, 'slug is invalid')(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'slug is invalid',
      })
    );
  });
});