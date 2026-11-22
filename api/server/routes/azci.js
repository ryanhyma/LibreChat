/**
 * Internal bridge used by the Azure Code Interpreter MCP server to pull chat attachments
 * into the sandbox. Authenticated with the same shared secret LibreChat sends on MCP calls;
 * the caller supplies the authenticated user id and conversation id it already received.
 */
const crypto = require('node:crypto');
const express = require('express');
const { FileSources } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const db = require('~/models');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { configMiddleware } = require('~/server/middleware');

const router = express.Router();

function tokenMatches(expected, received) {
  if (typeof expected !== 'string' || !expected || typeof received !== 'string' || !received) {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.use(configMiddleware);

router.use((req, res, next) => {
  if (!tokenMatches(process.env.AZCI_MCP_TOKEN, req.get('x-azci-token'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const userId = req.get('x-librechat-user-id');
  const conversationId = req.query.conversationId || req.get('x-librechat-conversation-id');
  const agentId = req.query.agentId || req.get('x-librechat-agent-id');
  if (!userId || !conversationId) {
    return res.status(400).json({ error: 'missing user or conversation' });
  }
  req.azci = { userId, conversationId, agentId: agentId || undefined };
  next();
});

/**
 * Resolve the files attached across a conversation's recent user messages. A follow-up
 * message often carries no attachment, so reading only the latest one would lose the
 * document the user attached earlier.
 */
/** File ids attached once to the agent (File Context / File Search resources). */
async function agentFileIds(userId, agentId) {
  if (!agentId) {
    return [];
  }
  const agent = await db.getAgent({ id: agentId, author: userId }, { tool_resources: 1 });
  const resources = agent?.tool_resources ?? {};
  const ids = new Set();
  for (const key of ['mcp']) {
    const resource = resources[key] ?? {};
    for (const id of resource.file_ids ?? []) {
      ids.add(id);
    }
    for (const file of resource.files ?? []) {
      if (file?.file_id) {
        ids.add(file.file_id);
      }
    }
  }
  return [...ids];
}

async function conversationFileIds(userId, conversationId, agentId) {
  if (!agentId) {
    // The conversation records its agent, so no extra header/placeholder is needed.
    const conversation = await db.getConvo(userId, conversationId);
    agentId = conversation?.agent_id;
  }
  const messages = await db.getMessages(
    { conversationId, isCreatedByUser: true },
    'files',
    { sort: { createdAt: -1 }, limit: 20 },
  );
  const ids = new Set(await agentFileIds(userId, agentId));
  for (const message of messages ?? []) {
    for (const entry of message?.files ?? []) {
      const id = typeof entry === 'string' ? entry : entry?.file_id;
      if (id) {
        ids.add(id);
      }
    }
  }
  if (!ids.size) {
    return [];
  }
  const files = await db.getFiles(
    { file_id: { $in: [...ids] }, user: userId },
    null,
    { text: 0 },
  );
  return files ?? [];
}

/** List the user-uploaded attachments of one conversation. */
router.get('/files', async (req, res) => {
  try {
    const { userId, conversationId } = req.azci;
    const files = await conversationFileIds(userId, conversationId, req.azci.agentId);
    res.json({
      files: (files ?? []).map((file) => ({
        file_id: file.file_id,
        filename: file.filename,
        bytes: file.bytes,
        type: file.type,
        source: file.source,
      })),
    });
  } catch (error) {
    logger.error('[azci] list files failed', error);
    res.status(500).json({ error: 'list failed' });
  }
});

/** Stream one attachment's bytes. */
router.get('/files/:fileId', async (req, res) => {
  try {
    const { userId, conversationId } = req.azci;
    const owned = await conversationFileIds(userId, conversationId, req.azci.agentId);
    const file = owned.find((entry) => entry.file_id === req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'not found' });
    }
    if (file.source !== FileSources.local) {
      return res.status(422).json({ error: `unsupported source: ${file.source}` });
    }
    const { getDownloadStream } = getStrategyFunctions(file.source);
    const stream = await getDownloadStream(req, file.storageKey || file.filepath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    stream.on('error', (error) => {
      logger.error('[azci] stream failed', error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    logger.error('[azci] download failed', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'download failed' });
    }
  }
});

module.exports = router;
