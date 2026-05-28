# Codex MCP Configuration Example

Recommended config for `~/.codex/config.toml` or a trusted project `.codex/config.toml` without requiring a global install. If your Codex build supports `enabled_tools`, keep the list restricted to the two tools shown here; otherwise omit that line.

```toml
[mcp_servers.codex_cc_tools]
command = "npx"
args = ["-y", "codex-cc-tools@latest", "mcp"]
startup_timeout_sec = 60
tool_timeout_sec = 900
required = false
enabled = true
enabled_tools = ["cc_review", "cc_delegate"]
```

Restart Codex after editing the config.

For stable day-to-day use, pin the package spec to a known version such as `codex-cc-tools@0.1.0`. The longer `startup_timeout_sec` is for `npx` cold starts; global installs can usually use a shorter startup timeout.

If the package is installed globally or linked into `PATH`, use the dedicated stdio server binary. The following JSON form is for MCP clients that use JSON configuration rather than Codex TOML:

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

DeepSeek requires `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK` in the environment that starts Codex or the MCP server. `ark_coding_plan` requires `ARK_API_KEY` or `VOLCENGINE_API_KEY` when explicitly selected. A variable exported only in a separate shell will not reach a GUI-launched Codex process. The default `anthropic` profile does not require `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` when native Claude Code auth works.
