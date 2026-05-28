# Installation

## Requirements

- Node.js 20 or newer
- npm or npx
- Claude Code CLI on `PATH`; `claude --version` should work
- A DeepSeek API key if you use `cc_delegate` without overriding `providerProfile`
- An Ark Coding Plan API key if you explicitly use `providerProfile: "ark_coding_plan"`
- Claude Code authenticated locally if you use the native `anthropic` provider profile
- Codex or another MCP client that can start a stdio MCP server

The native `anthropic` profile delegates to the native Claude Code CLI. Run Claude Code once interactively if local auth is not ready. It does not require `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` to be set in the process environment, although existing Anthropic, Bedrock, Vertex, and proxy route variables are inherited when present. The package resolves `model: "opus"` to `claude-opus-4-8` before invoking Claude Code.

The `deepseek` provider profile requires one of these variables in the environment that starts Codex or the MCP server:

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
# or
export OPENAI_API_KEY_DEEPSEEK="your-deepseek-api-key"
```

The MCP server inherits the environment of the process that launches it. GUI-launched Codex sessions may not see variables exported only in a shell startup file. On Windows, set a persistent user variable such as `setx DEEPSEEK_API_KEY "your-deepseek-api-key"` and restart Codex. On macOS/Linux, launch Codex from a shell with the variable exported or configure it in the desktop/session launcher.

The `ark_coding_plan` provider profile requires one of these variables in the
environment that starts Codex or the MCP server:

```bash
export ARK_API_KEY="your-ark-api-key"
# or
export VOLCENGINE_API_KEY="your-ark-api-key"
```

It defaults to the Ark Coding Plan Anthropic-compatible Claude Code endpoint
`https://ark.cn-beijing.volces.com/api/coding`. The OpenAI-compatible endpoint
`https://ark.cn-beijing.volces.com/api/coding/v3` is for OpenAI-wire clients,
not this Claude Code provider profile.

## Global Install

```bash
npm install -g codex-cc-tools
codex-cc-tools --version
codex-cc-tools doctor
```

## No Global Install

```bash
npx --prefer-online -y codex-cc-tools@latest --version
npx --prefer-online -y codex-cc-tools@latest doctor
```

For stable day-to-day use, pin the MCP config to a known version such as `codex-cc-tools@0.1.0`. Use `@latest` for quick setup and stable auto-updates. Use `@next` only for prerelease validation.

## Codex MCP Config

Recommended config for `~/.codex/config.toml` or a trusted project `.codex/config.toml`. If your Codex build supports `enabled_tools`, keep the list restricted to the two tools shown here; otherwise omit that line.

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

Restart Codex after changing MCP configuration.

The `npx` startup timeout is intentionally longer because the first launch may download the package on a cold npm cache or slow network. `tool_timeout_sec = 900` leaves room for expensive reviews and delegated tasks; reduce it for strictly read-only workflows if desired.

If the package is installed globally and `codex-cc-tools-mcp` is on `PATH`, this equivalent configuration avoids `npx` startup work:

```toml
[mcp_servers.codex_cc_tools]
command = "codex-cc-tools-mcp"
args = []
startup_timeout_sec = 20
tool_timeout_sec = 900
required = false
enabled = true
enabled_tools = ["cc_review", "cc_delegate"]
```

## CLI Smoke

The smoke `review` command below requires the `claude` command to be available and the default Claude Code profile to be usable.

```bash
codex-cc-tools --help
codex-cc-tools doctor
codex-cc-tools review --task review_doc --context "Smoke review only."
```

## Codex MCP Config Management

The CLI can manage the `codex_cc_tools` MCP config block in your Codex
configuration file without manual editing:

```bash
# Install config block with default npx launch mode
codex-cc-tools install

# Install with global binary launch mode (codex-cc-tools-mcp on PATH)
codex-cc-tools install --global-binary

# Install a specific package spec
codex-cc-tools install --package-spec codex-cc-tools@0.2.0

# Install to a custom config path
codex-cc-tools install --config-path /path/to/.codex/config.toml

# Remove the config block
codex-cc-tools uninstall
```

`codex-cc-tools install` writes a `[mcp_servers.codex_cc_tools]` block to
`~/.codex/config.toml` by default. An existing block for the same server name
is updated in place — `command` and `args` are replaced while user-owned keys
in the block are preserved. Existing `enabled_tools` values are preserved so a
user can intentionally restrict the exposed tool surface. The `--global-binary`
flag switches from `npx` to the `codex-cc-tools-mcp` global command. Use
`--no-enabled-tools` to omit the `enabled_tools` line when creating a new block
for older Codex clients.

Restart Codex after running `install` or `uninstall` so the MCP client picks
up the changed configuration.
DeepSeek smoke:

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
codex-cc-tools review \
  --provider-profile deepseek \
  --model deepseek-v4-flash \
  --task review_doc \
  --context "DeepSeek route smoke only. Report whether this review invocation works."
```

Ark Coding Plan smoke:

```bash
export ARK_API_KEY="your-ark-api-key"
codex-cc-tools review \
  --provider-profile ark_coding_plan \
  --model opus \
  --task review_doc \
  --context "Ark Coding Plan route smoke only. Report whether this review invocation works."
```

## Local Development

```bash
npm install
npm run build
node dist/index.js doctor
node dist/index.js mcp
```

Equivalent MCP server entry points:

```bash
codex-cc-tools-mcp
codex-cc-tools mcp
node dist/mcp-server.js
```

## Provider Profiles

`anthropic` uses the caller's existing Claude Code profile and authentication state. Existing Anthropic, Bedrock, Vertex, and proxy route variables are inherited by design. The `opus` model input resolves to `claude-opus-4-8`; other Anthropic model names pass through.

`deepseek` is configured per Claude Code child process from `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK`. The package does not rewrite the user's shell profile. It injects DeepSeek's Anthropic-compatible endpoint and model variables into the child process, and removes inherited Anthropic, Bedrock, Vertex, and provider-token route variables from that child process first.

`ark_coding_plan` is configured per Claude Code child process from
`ARK_API_KEY` or `VOLCENGINE_API_KEY`. The package injects Ark Coding Plan's
Anthropic-compatible endpoint and `doubao-seed-2.0-pro` alias defaults, while
removing inherited Anthropic, Bedrock, Vertex, DeepSeek, Ark, and other
provider-token route variables first.

See [security.md](security.md) for provider environment and redaction boundaries.
