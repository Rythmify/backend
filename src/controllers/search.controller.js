const searchService = require('../services/search.service');

const VALID_TIME_RANGES = ['past_hour', 'past_day', 'past_week', 'past_month', 'past_year'];
const VALID_DURATIONS = ['short', 'medium', 'long', 'extra'];

async function search(req, res) {
  const {
    q,
    type,
    sort = 'relevance',
    limit = 20,
    offset = 0,
    // filter params
    time_range,
    duration,
    tag,
    location,
  } = req.query;

  // ── Validation ────────────────────────────────────────────────────────────

  if (!q || q.trim().length < 1){
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'q', issue: 'Query must be at least 2 characters' }],
      },
    });
  }
  if (type === 'everything') {
    const validEverythingSorts = ['relevance', 'newest'];
    if (!validEverythingSorts.includes(sort)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [{ field: 'sort', issue: 'type=everything only supports: relevance, newest' }],
        },
      });
    }
    try {
      const results = await searchService.searchEverything({
        q: q.trim(),
        sort,
        currentUserId: req.user?.sub ?? null,
      });
      return res.status(200).json({
        data: results.data,
        pagination: results.pagination,
        filters: results.filters,
      });
    } catch (err) {
      console.error('[SearchController] everything error:', err);
      return res.status(500).json({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      });
    }
  }
  const validTypes = ['tracks', 'users', 'playlists', 'albums'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'type', issue: `Must be one of: everything, ${validTypes.join(', ')}` }],
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

  // time_range is only valid when type=tracks
  if (time_range) {
    if (type !== 'tracks') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [
            { field: 'time_range', issue: 'time_range filter only applies to type=tracks' },
          ],
        },
      });
    }
    if (!VALID_TIME_RANGES.includes(time_range)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [
            {
              field: 'time_range',
              issue: `Must be one of: ${VALID_TIME_RANGES.join(', ')}`,
            },
          ],
        },
      });
    }
  }

  // duration is only valid when type=tracks
  if (duration) {
    if (type !== 'tracks') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [{ field: 'duration', issue: 'duration filter only applies to type=tracks' }],
        },
      });
    }
    if (!VALID_DURATIONS.includes(duration)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [
            {
              field: 'duration',
              issue: `Must be one of: ${VALID_DURATIONS.join(', ')} (short=<2min, medium=2-10min, long=10-30min, extra=>30min)`,
            },
          ],
        },
      });
    }
  }

  // tag filter — valid for tracks, playlists, albums only
  if (tag && type === 'users') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'tag', issue: 'tag filter does not apply to type=users' }],
      },
    });
  }

  // location filter — only valid for type=users
  if (location && type !== 'users') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'location', issue: 'location filter only applies to type=users' }],
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
      // filters — undefined when not provided (service treats undefined as "no filter")
      time_range: time_range || undefined,
      duration: duration || undefined,
      tag: tag?.trim() || undefined,
      location: location?.trim() || undefined,
    });

    return res.status(200).json({
      data: results.data,
      pagination: results.pagination,
      filters: results.filters, // null when no type specified
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
