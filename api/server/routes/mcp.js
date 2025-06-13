const express = require('express');
const { reinitializeMCP } = require('~/server/controllers/MCPController');

const router = express.Router();

// No authentication middleware applied
router.get('/refresh', reinitializeMCP);

module.exports = router;
