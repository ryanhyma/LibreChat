# Azure Code Interpreter MCP bridge

This branch adds the LibreChat half of the Azure code-interpreter MCP integration. It is generic:
any MCP tool can use it, not only the Azure server.

## What it adds

1. **Generic MCP artifact contract** — an MCP tool may return
   `structuredContent.artifacts[] = {name, mimeType, bytes(base64) | downloadUrl}`.
   `createMCPStructuredTool` forwards it into the tool result's `artifact` with
   `__librechat_file_authoring: true`; `preflightCodeOutputBatch` honours a pre-supplied
   `preparedBuffer`, so the existing code-output pipeline stores it and `writeAttachment` emits it.
   Images already delivered as MCP image content are not duplicated.
2. **Chat-file bridge** — `GET /api/azci/files` and `GET /api/azci/files/:fileId`, gated by
   `X-Azci-Token` + `X-LibreChat-User-Id`, resolve the conversation's attachments (last 20 user
   messages) and the agent's dedicated MCP file pool, then stream the bytes to the MCP server.
3. **MCP files pool** — `EToolResources.mcp` (`tool_resources.mcp`), a new **MCP files** section in the
   MCP server dialog (en/fr). Files are added once per agent, available to every MCP tool, and never
   injected into the model prompt. Uploads use `tool_resource=mcp`.
4. **Mixed image + file results** — the tool-end callback no longer returns after images when the
   artifact also carries a file list.

## Configuration

```yaml
mcpServers:
  azureci:
    type: streamable-http
    url: http://host.docker.internal:8935/mcp
    requiresOAuth: false
    headers:
      X-Azci-Token: '${AZCI_MCP_TOKEN}'
    requestHeaders:
      X-LibreChat-User-Id: '{{LIBRECHAT_USER_ID}}'
      X-LibreChat-Conversation-Id: '{{LIBRECHAT_BODY_CONVERSATIONID}}'
```

Also add `host.docker.internal:8935` to `mcpSettings.allowedAddresses`.

## Tests

```bash
cd packages/api && npx jest src/mcp/__tests__/parsers.test.ts src/files/code/preflight.spec.ts
cd api && npx jest server/routes/__tests__/azci.spec.js
cd client && npx jest src/components/SidePanel/Agents/__tests__/McpFiles.spec.tsx \
  src/components/SidePanel/Agents/Tools/ItemDialog/__tests__/McpSection.spec.tsx
```

Real-provider E2E (needs the MCP server and a test agent with a pooled file):

```bash
AZCI_E2E=1 npx playwright test -c e2e/playwright.azci.config.ts
```

## Notes

- Built against the `v0.8.9` tag; applies as a standalone patch to that tag.
- The preview pane uses Sandpack, which needs a secure context: browse over HTTPS or `localhost`.
- `Dockerfile.multi` does not create `/app/api/logs`; the deployment creates it with uid 1000.
