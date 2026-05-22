# Codex MCP Configuration Example

Use the dedicated stdio server binary after installing the package globally or linking it into `PATH`:

```json
{
  "mcpServers": {
    "codex-cc-tools": {
      "command": "codex-cc-tools-mcp",
      "args": []
    }
  }
}
```

For local development from this repository:

```json
{
  "mcpServers": {
    "codex-cc-tools": {
      "command": "node",
      "args": ["<absolute path to your clone>/dist/mcp-server.js"]
    }
  }
}
```

Replace the placeholder with the absolute path to `dist/mcp-server.js` in your local clone after running `npm run build`.

The writable `cc_delegate` tool is marked destructive. Configure client approval policies accordingly.
