// ============================================================
// services/tags.service.js
// ============================================================
const tagModel = require('../models/tag.model');

const getAllTags = async () => {
  const tags = await tagModel.getAllTags();

  return {
    items: tags,
  };
};

module.exports = {
  getAllTags,
};
