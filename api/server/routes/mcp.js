const express = require('express');
const { reinitializeMCP } = require('~/server/controllers/MCPController');

const router = express.Router();

// No authentication middleware applied
router.post('/refresh', reinitializeMCP);

module.exports = router;
