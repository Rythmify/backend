// ============================================================
// controllers/insights.controller.js
// Receives creator insights requests -> calls service -> returns response.
// ============================================================
const insightsService = require('../services/insights.service');
const { success } = require('../utils/api-response');

exports.getMyInsights = async (req, res) => {
  const data = await insightsService.getMyInsights({
    userId: req.user.sub,
    range: req.query.range,
    trackId: req.query.track_id,
    timezone: req.query.timezone,
  });

  return success(res, data, 'Insights fetched successfully.', 200);
};
