# codex-cc-tools

面向 Codex 的 Claude Code 任务工具集。

本仓库不是 `codex-cc-reviewer` 的重命名，而是更大的 CLI 和 MCP 工具族。它把三件事分开：

- provider profile：Claude Code 使用哪个后端，例如 `anthropic` 或 `deepseek`。
- task：Codex 要 Claude Code 做什么，例如 `review`、`research`、`verify`、`delegate`。
- execution policy：本地权限边界，例如只读、命令执行、工作区写入。

## 当前工具

- `cc_review` / `review`：只读审阅计划、diff 或文档。
- `cc_research` / `research`：只读代码库调查。
- `cc_verify` / `verify`：在显式命令白名单内做验证。
- `cc_delegate` / `delegate`：显式可写子任务，带隔离和路径安全检查。

## 常用命令

```bash
npm install
npm run build
node dist/index.js --help
node dist/index.js doctor
node dist/index.js mcp
```

安装后的 MCP server 可直接使用独立命令：

```bash
codex-cc-tools-mcp
```

## Beta 安装

第一个公开过渡通道使用 npm `next`：

```bash
npx --prefer-online -y codex-cc-tools@next --version
npx --prefer-online -y codex-cc-tools@next doctor
npx --prefer-online -y codex-cc-tools@next mcp
```

做长期 beta 验证时，将 MCP 客户端命令指向 `codex-cc-tools@next` 提供的 `codex-cc-tools-mcp`。

`delegate` 是可写工具。真实使用前应在 linked worktree、容器或其它调用方管理的隔离环境中运行，并阅读 `docs/delegate-safety.md`。
