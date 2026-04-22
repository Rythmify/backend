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
      currentUserId: req.user?.sub ?? null,
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

async function suggestions(req, res) {
  const { q, limit = 5 } = req.query;

  if (!q || q.trim().length < 1) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'q', issue: 'Query must be at least 1 character' }],
      },
    });
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);

  try {
    const result = await searchService.getSuggestions({
      q: q.trim(),
      limit: parsedLimit,
      userId: req.user?.sub ?? null,
    });

    return res.status(200).json({ data: result });
  } catch (err) {
    console.error('[SearchController] error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

module.exports = { search, suggestions };
