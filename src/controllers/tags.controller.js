// ============================================================
// controllers/tags.controller.js
// ============================================================
const tagsService = require('../services/tags.service');
const { success } = require('../utils/api-response');

const parsePagination = (query = {}) => {
  const parsedLimit = Number.parseInt(query.limit, 10);
  const parsedOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
};

const getAllTags = async (req, res) => {
  const pagination = parsePagination(req.query);
  const data = await tagsService.getAllTags(pagination);

  return success(res, data.data, 'Tags fetched successfully', 200, data.pagination);
};

module.exports = {
  getAllTags,
};
