const searchService = require('../services/search.service');

async function search(req, res) {
  const { q, type, sort = 'relevance', limit = 20, offset = 0 } = req.query;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'q', issue: 'Query must be at least 2 characters' }],
      },
    });
  }

  const validTypes = ['tracks', 'users', 'playlists'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'type', issue: `Must be one of: ${validTypes.join(', ')}` }],
      },
    });
  }

  const validSorts = ['relevance', 'newest', 'plays'];
  if (!validSorts.includes(sort)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'sort', issue: `Must be one of: ${validSorts.join(', ')}` }],
      },
    });
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  // ── Service call ──────────────────────────────────────────────────────────
  try {
    const results = await searchService.search({
      q: q.trim(),
      type,
      sort,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    return res.status(200).json({
      data: results.data,
      pagination: results.pagination,
    });
  } catch (err) {
    console.error('[SearchController] search error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

module.exports = { search };
