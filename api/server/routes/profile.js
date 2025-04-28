const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { getProfileController } = require('~/server/controllers/ProfileController');

const router = express.Router();

// GET /api/user/profile - returns user info and usage stats
router.get('/profile', requireJwtAuth, getProfileController);

module.exports = router;
