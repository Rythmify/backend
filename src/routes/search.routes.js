const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { optionalAuthenticate } = require('../middleware/auth');

// GET /search
router.get('/search', optionalAuthenticate, searchController.search);
//router.get('/resolve', searchController.resolve);
router.get('/suggestions', optionalAuthenticate, searchController.suggestions);

module.exports = router;
