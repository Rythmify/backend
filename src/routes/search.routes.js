const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { authenticate } = require('../middleware/auth');

// GET /search
router.get('/search', searchController.search);
//router.get('/resolve', searchController.resolve);

module.exports = router;
