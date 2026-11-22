jest.mock('~/models', () => ({
  getMessages: jest.fn(),
  getFiles: jest.fn(),
  getAgent: jest.fn(),
  getConvo: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  configMiddleware: (req, _res, next) => {
    req.config = { paths: { uploads: '/uploads' } };
    next();
  },
}));

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const { Readable } = require('stream');
const express = require('express');
const request = require('supertest');
const db = require('~/models');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const azciRoute = require('../azci');

const TOKEN = 'test-token';
const USER = 'user-1';
const CONV = 'conv-1';

function app() {
  const instance = express();
  instance.use('/api/azci', azciRoute);
  return instance;
}

function authed(req) {
  return req.set('X-Azci-Token', TOKEN).set('X-LibreChat-User-Id', USER);
}

beforeEach(() => {
  process.env.AZCI_MCP_TOKEN = TOKEN;
  jest.clearAllMocks();
  db.getConvo.mockResolvedValue(null);
  db.getAgent.mockResolvedValue(null);
  db.getMessages.mockResolvedValue([]);
  db.getFiles.mockResolvedValue([]);
});

describe('azci bridge auth', () => {
  it('returns 401 without the shared token', async () => {
    await request(app()).get('/api/azci/files').query({ conversationId: CONV }).expect(401);
  });

  it('returns 401 for a wrong token', async () => {
    await request(app())
      .get('/api/azci/files')
      .query({ conversationId: CONV })
      .set('X-Azci-Token', 'nope')
      .set('X-LibreChat-User-Id', USER)
      .expect(401);
  });

  it('returns 400 without a user id', async () => {
    await request(app())
      .get('/api/azci/files')
      .query({ conversationId: CONV })
      .set('X-Azci-Token', TOKEN)
      .expect(400);
  });
});

describe('azci file listing', () => {
  it('unions attachments across recent user messages and dedupes ids', async () => {
    db.getMessages.mockResolvedValue([
      { files: [{ file_id: 'f2' }] },
      { files: [] },
      { files: ['f1', { file_id: 'f2' }] },
    ]);
    db.getFiles.mockResolvedValue([
      { file_id: 'f1', filename: 'a.csv', bytes: 1, type: 'text/csv', source: 'local' },
      { file_id: 'f2', filename: 'b.csv', bytes: 2, type: 'text/csv', source: 'local' },
    ]);

    const res = await authed(request(app()).get('/api/azci/files').query({ conversationId: CONV })).expect(200);

    expect(db.getMessages).toHaveBeenCalledWith(
      { conversationId: CONV, isCreatedByUser: true },
      'files',
      expect.objectContaining({ limit: 20 }),
    );
    expect(db.getFiles).toHaveBeenCalledWith(
      { file_id: { $in: expect.arrayContaining(['f1', 'f2']) }, user: USER },
      null,
      { text: 0 },
    );
    const ids = res.body.files.map((f) => f.file_id);
    expect(ids).toEqual(expect.arrayContaining(['f1', 'f2']));
    expect(ids).toHaveLength(2);
  });

  it('includes files attached once to the agent context', async () => {
    db.getMessages.mockResolvedValue([{ files: [] }]);
    db.getAgent.mockResolvedValue({
      tool_resources: {
        mcp: { file_ids: ['ctx-1'], files: [{ file_id: 'ctx-2' }] },
        context: { file_ids: ['ignored-context'] },
      },
    });
    const rows = [
      { file_id: 'ctx-1', filename: 'context.pdf', bytes: 1, type: 'application/pdf', source: 'local' },
      { file_id: 'ctx-2', filename: 'notes.docx', bytes: 1, type: 'application/docx', source: 'local' },
      { file_id: 'fs-1', filename: 'search.txt', bytes: 1, type: 'text/plain', source: 'local' },
    ];
    db.getFiles.mockImplementation(async (filter) => {
      const wanted = filter?.file_id?.$in;
      return wanted ? rows.filter((row) => wanted.includes(row.file_id)) : rows;
    });

    const res = await authed(
      request(app())
        .get('/api/azci/files')
        .query({ conversationId: CONV, agentId: 'agent-1' })
        .set('X-LibreChat-Agent-Id', 'agent-1'),
    ).expect(200);

    expect(db.getAgent).toHaveBeenCalledWith(
      { id: 'agent-1', author: USER },
      { tool_resources: 1 },
    );
    expect(res.body.files.map((f) => f.file_id)).toEqual(['ctx-1', 'ctx-2']);
  });

  it('derives the agent from the conversation when no agent id is supplied', async () => {
    db.getConvo.mockResolvedValue({ agent_id: 'agent-from-convo' });
    db.getMessages.mockResolvedValue([{ files: [] }]);
    db.getAgent.mockResolvedValue({
      tool_resources: { mcp: { file_ids: ['ctx-9'] } },
    });
    db.getFiles.mockResolvedValue([
      { file_id: 'ctx-9', filename: 'brief.docx', bytes: 1, type: 'application/docx', source: 'local' },
    ]);

    const res = await authed(
      request(app()).get('/api/azci/files').query({ conversationId: CONV }),
    ).expect(200);

    expect(db.getConvo).toHaveBeenCalledWith(USER, CONV);
    expect(db.getAgent).toHaveBeenCalledWith(
      { id: 'agent-from-convo', author: USER },
      { tool_resources: 1 },
    );
    expect(res.body.files.map((f) => f.file_id)).toEqual(['ctx-9']);
  });

  it('returns an empty list when no user message carries a file', async () => {
    db.getMessages.mockResolvedValue([{ files: [] }]);
    const res = await authed(request(app()).get('/api/azci/files').query({ conversationId: CONV })).expect(200);
    expect(res.body.files).toEqual([]);
    expect(db.getFiles).not.toHaveBeenCalled();
  });
});

describe('azci file download', () => {
  it('streams the bytes of a conversation attachment', async () => {
    db.getMessages.mockResolvedValue([{ files: [{ file_id: 'f1' }] }]);
    db.getFiles.mockResolvedValue([
      { file_id: 'f1', filename: 'a.csv', filepath: '/uploads/a.csv', source: 'local' },
    ]);
    getStrategyFunctions.mockReturnValue({
      getDownloadStream: jest.fn().mockResolvedValue(Readable.from(Buffer.from('a,b\n1,2\n'))),
    });

    const res = await authed(
      request(app()).get('/api/azci/files/f1').query({ conversationId: CONV }),
    ).expect(200);

    expect(Buffer.from(res.body).toString()).toBe('a,b\n1,2\n');
  });

  it('returns 404 when the file is not among the conversation attachments', async () => {
    db.getMessages.mockResolvedValue([{ files: [{ file_id: 'other' }] }]);
    db.getFiles.mockResolvedValue([{ file_id: 'other', filename: 'x.csv', source: 'local' }]);

    await authed(request(app()).get('/api/azci/files/f1').query({ conversationId: CONV })).expect(404);
  });

  it('refuses a source that has no local stream', async () => {
    db.getMessages.mockResolvedValue([{ files: [{ file_id: 'f1' }] }]);
    db.getFiles.mockResolvedValue([{ file_id: 'f1', filename: 'a.csv', source: 's3' }]);

    await authed(request(app()).get('/api/azci/files/f1').query({ conversationId: CONV })).expect(422);
  });
});
