// ============================================================
// controllers/tags.controller.js
// ============================================================
const { success } = require('../utils/api-response');
const tagsService = require('../services/tags.service');

const getAllTags = async (req, res) => {
  const data = await tagsService.getAllTags();

  return success(res, data, 'Tags fetched successfully', 200);
};

module.exports = {
  getAllTags,
};