// ============================================================
// tests/utils/api-response.test.js
// Coverage Target: 100%
// ============================================================
const apiResponse = require('../../src/utils/api-response');

describe('API Response Utility', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('success', () => {
    it('sends default success response', () => {
      apiResponse.success(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ data: null, message: 'OK' });
    });

    it('sends data and custom message', () => {
      apiResponse.success(mockRes, { id: 1 }, 'Created', 201);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ data: { id: 1 }, message: 'Created' });
    });

    it('includes pagination if provided', () => {
      apiResponse.success(mockRes, [], 'OK', 200, { total: 10 });
      expect(mockRes.json).toHaveBeenCalledWith({ data: [], message: 'OK', pagination: { total: 10 } });
    });
  });

  describe('error', () => {
    it('sends default error response', () => {
      apiResponse.error(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });

    it('includes details if provided', () => {
      apiResponse.error(mockRes, 'VALIDATION_ERROR', 'Bad input', 400, { field: 'email' });
      expect(mockRes.json).toHaveBeenCalledWith({
        error: { code: 'VALIDATION_ERROR', message: 'Bad input', details: { field: 'email' } }
      });
    });
  });
});
