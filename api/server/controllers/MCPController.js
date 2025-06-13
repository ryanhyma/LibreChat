const { processMCPEnv } = require('librechat-data-provider');
const { MCPManager } = require('@librechat/api');
const { getMCPManager, logger } = require('~/config');
const { getCustomConfig } = require('~/server/services/Config');
const { loadAndFormatTools } = require('~/server/services/ToolService');

/**
 * Reinitializes MCP servers and refreshes available tools
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function reinitializeMCP(req, res) {
  try {
    const config = await getCustomConfig();
    if (!config?.mcpServers) {
      return res.status(400).json({ message: 'MCP servers not configured' });
    }

    await MCPManager.destroyInstance();
    const mcpManager = getMCPManager();
    await mcpManager.initializeMCP(config.mcpServers, processMCPEnv);

    const { filteredTools = [], includedTools = [], paths } = req.app.locals;
    const tools = loadAndFormatTools({
      adminFilter: filteredTools,
      adminIncluded: includedTools,
      directory: paths.structuredTools,
    });
    await mcpManager.mapAvailableTools(tools);
    req.app.locals.availableTools = tools;

    res.status(200).json({ message: 'MCP reinitialized' });
  } catch (error) {
    logger.error('Failed to reinitialize MCP', error);
    res.status(500).json({ message: error.message });
  }
}

module.exports = { reinitializeMCP };
