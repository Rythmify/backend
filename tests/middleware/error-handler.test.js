const errorHandler = require('../../src/middleware/error-handler');
const api = require('../../src/utils/api-response');

jest.mock('../../src/utils/api-response', () => ({
  error: jest.fn(),
}));

describe('error-handler middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { method: 'POST', path: '/upload' };
    res = {};
    next = jest.fn();
    api.error.mockReset();
  });

  it('maps file-size limit errors to 413', () => {
    errorHandler({ code: 'LIMIT_FILE_SIZE', message: 'too big' }, req, res, next);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'UPLOAD_FILE_TOO_LARGE',
      'File size exceeds the allowed limit',
      413
    );
  });

  it('maps invalid audio format errors to 415', () => {
    errorHandler({ message: 'Invalid audio format' }, req, res, next);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'UPLOAD_INVALID_FILE_TYPE',
      'Unsupported file format',
      415
    );
  });

  it('maps invalid image format errors to 415', () => {
    errorHandler({ message: 'Invalid image format' }, req, res, next);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'UPLOAD_INVALID_FILE_TYPE',
      'Unsupported file format',
      415
    );
  });

  it('maps unexpected file field errors to 400', () => {
    errorHandler({ message: 'Unexpected file field' }, req, res, next);

    expect(api.error).toHaveBeenCalledWith(
      res,
      'VALIDATION_FAILED',
      'Unexpected file field',
      400
    );
  });

  it('falls back to the generic error response when no special case matches', () => {
    errorHandler({ message: 'boom', statusCode: 502, code: 'UPSTREAM_BAD_GATEWAY' }, req, res, next);

    expect(api.error).toHaveBeenCalledWith(res, 'UPSTREAM_BAD_GATEWAY', 'boom', 502);
  });

  it('uses defaults when the error object is sparse', () => {
    errorHandler({}, req, res, next);

    expect(api.error).toHaveBeenCalledWith(res, 'INTERNAL_ERROR', 'Internal Server Error', 500);
  });
});