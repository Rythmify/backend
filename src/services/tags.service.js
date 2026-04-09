// ============================================================
// services/tags.service.js
// ============================================================
const tagModel = require('../models/tag.model');

const getAllTags = async ({ limit, offset }) => {
  const tags = await tagModel.getAllTags();
  const total = tags.length;

  return {
    data: tags.slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total,
    },
  };
};

module.exports = {
  getAllTags,
};
