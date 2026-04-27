const resolveService = require('../services/resolve.service');

async function resolve(req, res) {
  const { url } = req.query;

  if (!url || !url.trim()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'url', issue: 'url query parameter is required' }],
      },
    });
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'Invalid URL' },
    });
  }

  try {
    const result = await resolveService.resolve(parsed.pathname);

    if (!result) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }

    return res.status(200).json({
      data: {
        type: result.type,
        id: result.id,
        permalink: url.trim(),
      },
    });
  } catch (err) {
    console.error('[ResolveController] error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
}

module.exports = { resolve };
