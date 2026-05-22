# codex-cc-tools

[English](README.md) | [简体中文](README.zh-CN.md)

面向 Codex 的 Claude Code MCP 任务工具集。

**Codex 负责任务编排，Claude Code 执行有边界的任务，Codex 做最终判断。**

本仓库不是 `codex-cc-reviewer` 的重命名，而是同一架构下更聚焦的工具族：

- provider profile：Claude Code 使用哪个后端，例如 `anthropic` 或 `deepseek`
- task：Codex 要 Claude Code 做什么，目前是 `review` 或 `delegate`
- authority：只读审阅或显式工作区写入
- result contract：返回 Codex 可以直接综合、采纳、拒绝或搁置的结构化结果

## 快速开始

要求：

- Node.js 20 或更新版本
- npm 或 npx
- 本机可运行 `claude`，并且 `claude --version` 应该成功
- 使用 `cc_delegate` 且不覆盖 `providerProfile` 时需要 DeepSeek API key
- 如果使用原生 `anthropic` provider profile，需要 Claude Code 已完成本地登录或配置
- Codex 或其他支持 stdio MCP server 的客户端

全局安装：

```bash
npm install -g codex-cc-tools
codex-cc-tools --version
codex-cc-tools doctor
```

不全局安装也可以直接用 npx：

```bash
npx --prefer-online -y codex-cc-tools@latest --version
npx --prefer-online -y codex-cc-tools@latest doctor
```

日常稳定使用时，可以把 MCP 配置 pin 到已知版本，例如 `codex-cc-tools@0.1.0`。`@latest` 适合快速配置和接收稳定更新，`@next` 只用于 prerelease 验证。

把 MCP server 加到 `~/.codex/config.toml` 或可信项目的 `.codex/config.toml`。如果你的 Codex 版本支持 `enabled_tools`，建议只保留这里列出的两个工具；如果不支持，可以删掉这一行，依赖 MCP server 注册的工具 metadata。

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

修改配置后重启 Codex。

如果已经全局安装并且 `codex-cc-tools-mcp` 在 `PATH` 上，也可以这样配：

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

## 发布用户需要提供哪些参数

原生 `providerProfile: "anthropic"` 会委托给原生 `claude` 命令。先确认 `claude --version` 成功；如果 Claude Code 本地认证还没准备好，先交互式运行一次 Claude Code。

`anthropic` profile 不要求用户提供 `ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY` 环境变量。Claude Code 可以使用自己的本地登录态、profile、keychain、OAuth 或已有路由配置。如果环境里已经存在 Anthropic、Bedrock、Vertex 或代理路由变量，它们会被 Claude Code 子进程继承；这些是可选输入，不是必需配置。

如果要使用 DeepSeek，需要在启动 Codex 或 MCP server 的环境里设置其中一个：

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
# 或
export OPENAI_API_KEY_DEEPSEEK="your-deepseek-api-key"
```

同时存在时优先使用 `DEEPSEEK_API_KEY`。可选覆盖：

```bash
DEEPSEEK_ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
```

普通用户不需要设置这个覆盖项。

MCP server 继承的是启动它的进程环境。Codex 如果从 GUI 启动，可能看不到只写在 shell 启动脚本里的变量。Windows 上可以用 `setx DEEPSEEK_API_KEY "your-deepseek-api-key"` 设置持久用户变量，然后重启 Codex。macOS/Linux 上可以从已 export key 的 shell 启动 Codex，或把变量配置到启动 Codex 的桌面/session launcher。

当调用时传入 `providerProfile: "deepseek"`，本包会为 Claude Code 子进程临时构造 DeepSeek 路由：

- `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`
- `ANTHROPIC_AUTH_TOKEN=<解析到的 DeepSeek key>`
- `ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]`
- `ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash`
- `ANTHROPIC_SMALL_FAST_MODEL=deepseek-v4-flash`
- `CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash`
- `CLAUDE_CODE_EFFORT_LEVEL=<请求的 effort>`

本包不会改写用户 shell profile。DeepSeek 子进程会先移除继承来的 Anthropic、Bedrock、Vertex 和 provider token 路由变量，再注入 DeepSeek 变量。返回结果会尽力脱敏 provider token。

DeepSeek profile 接受的模型参数：

| 输入模型 | 实际 DeepSeek 模型 |
| --- | --- |
| `opus` | `deepseek-v4-pro[1m]` |
| `sonnet` | `deepseek-v4-pro[1m]` |
| `haiku` | `deepseek-v4-flash` |
| `deepseek-v4-pro[1m]` | `deepseek-v4-pro[1m]` |
| `deepseek-v4-flash` | `deepseek-v4-flash` |

## 工具

| MCP 工具 | CLI 命令 | 权限 | 用途 |
| --- | --- | --- | --- |
| `cc_review` | `codex-cc-tools review` | 只读产品约束 | 审阅计划、diff、文档、对抗性方案 |
| `cc_delegate` | `codex-cc-tools delegate` | destructive Claude Code 执行 | 自主委托子任务，包括只读调查和可写实现 |

推荐给 Codex 的工作流提示：

```text
复杂变更中，在关键检查点使用 codex-cc-tools。
实现前和最终 diff 前使用 cc_review。
把独立子任务交给 cc_delegate；在 prompt 里明确这是只读调查还是可写实现，范围独立时可以并行调用。
Claude Code 的输出是建议性证据，Codex 必须明确说明采纳、拒绝或搁置哪些发现。
```

## 常见 MCP 输入

所有工具都支持：

- `providerProfile`：`cc_review` 默认 `anthropic`；`cc_delegate` 默认 `deepseek`
- `model`：默认 `opus`，按 provider profile 解析别名
- `effort`：默认 `max`，可选 `low`、`medium`、`high`、`max`
- `cwd`：适用任务的工作目录
- `maxContextChars`：默认 `120000`
- `stream`：默认 `true`
- `cacheTtl`：默认 `1h`，可选 `5m` 或 `1h`

`cc_review` 示例：

```json
{
  "task": "review_diff",
  "context": "Review the current diff for correctness regressions.",
  "reviewFocus": "Prioritize confirmed bugs and missing tests.",
  "includeGitDiff": true,
  "includeGitStatus": true,
  "providerProfile": "anthropic"
}
```

`task` 可选 `review_plan`、`review_diff`、`review_doc`、`adversarial_review`。常用可选字段包括 `originalGoal`、`codexSummary`、`acceptanceCriteria`、`knownRisks`、`testsRun`、`permissionMode`、`tools`、`includeUntrackedContent`、`redactSecrets`。

`cc_delegate` 示例：

```json
{
  "prompt": "Update README examples for the new provider profile, then report changed files and commands run.",
  "cwd": "/path/to/repo"
}
```

`cc_delegate` 默认使用 `providerProfile: "deepseek"`。它在 MCP metadata 中标记为 destructive，因为会使用 Claude Code 的非交互 `bypassPermissions` 模式自主执行。只要 prompt 明确禁止改文件，它也可用于只读调查；但工具元数据必须反映它具备写入能力。它不创建、不检查、也不强制执行空间。如果需要 worktree、容器、临时目录、分支策略或命令策略，请在调用 MCP 前由外层准备好，再把最终要求写进 `prompt`。

多个 `cc_delegate` 调用可以并行发起，前提是调用方确保它们都是只读任务，或写入范围互不重叠。

## CLI 示例

```bash
codex-cc-tools doctor
codex-cc-tools review --task review_doc --context "Smoke review only." --model haiku
```

PowerShell `delegate` 示例：

```powershell
codex-cc-tools delegate --prompt "Edit README, then summarize changed files and checks run." --cwd "D:\Codes\repo"
```

DeepSeek CLI 冒烟：

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
codex-cc-tools review \
  --provider-profile deepseek \
  --model deepseek-v4-flash \
  --task review_doc \
  --context "DeepSeek route smoke only. Report whether this review invocation works."
```

在 shell 里直接传带方括号的 DeepSeek 模型名时需要加引号，例如 `--model 'deepseek-v4-pro[1m]'`。使用 `opus`、`sonnet`、`haiku` 这些别名可以避开这个问题。

## 安全边界

本包面向可信本地 owner workflow。它不会把 Claude Code 变成可安全处理不可信代码库的沙箱。

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `providerProfile` | `cc_review`: `anthropic`; `cc_delegate`: `deepseek` | `anthropic` 使用原生 Claude Code profile/auth。`deepseek` 需要 MCP server 环境里有 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY_DEEPSEEK`。 |
| `model` | `opus` | DeepSeek profile 中，`opus` 和 `sonnet` 映射到 `deepseek-v4-pro[1m]`，`haiku` 映射到 `deepseek-v4-flash`。 |
| `effort` | `max` | 更慢，也可能更贵。对按量计费 provider，常规检查建议改成 `medium` 或 `low`。 |
| `cacheTtl` | `1h` | 给 Claude Code prompt cache 的提示；cache 和 cost 字段以 Claude Code/provider 报告为准。 |
| `redactSecrets` | review 证据默认 `true` | 只是尽力脱敏；不要把秘密放进 prompt、文件或命令输出。 |
| review 的 `permissionMode` | `bypassPermissions` | 会跳过 Claude Code 的交互式权限提示。只建议在自己控制的仓库中使用默认值；共享或敏感仓库应收窄工具和权限。 |
| `cc_delegate` 工具 | Claude Code 非交互执行 | 接收完整 prompt，并以 `bypassPermissions` 运行 Claude Code；执行空间策略属于外部。 |

完整 provider 边界见 [docs/security.md](docs/security.md)。完整 schema 见 [docs/tool-contract.md](docs/tool-contract.md)。

## 故障排查

```bash
codex-cc-tools doctor
```

常见问题：

- 找不到 `claude`：安装 Claude Code 并确认它在 `PATH` 上。
- Claude 未登录：先交互式运行一次 Claude Code 并完成认证。
- Codex 看不到工具：修改 MCP 配置后重启 Codex。
- DeepSeek 提示缺少凭据：在启动 Codex 或 MCP server 的环境里设置 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY_DEEPSEEK`。
- 只在某个终端里设置 key 不够，除非 Codex/MCP server 也是从这个终端启动的。请从包含该变量的环境重启 Codex，或设置 OS 级持久用户变量。
- DeepSeek 控制台没有请求：对照返回诊断里的 token source，例如 `DeepSeek route target: api.deepseek.com; token source: OPENAI_API_KEY_DEEPSEEK.`，确认监控的是同一个 key/账号。
- `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` 为空：`anthropic` profile 下这不是错误，只要原生 Claude Code auth 可用即可。
- 任务超时：提高 Codex 配置里的 `tool_timeout_sec` 或任务输入里的 `timeoutMs`。
- MCP 使用 `npx` 启动超时：第一次 `npx` 可能受 npm 冷缓存或网络影响较慢。`npx` 配置建议保留 `startup_timeout_sec = 60`；全局安装后的 `codex-cc-tools-mcp` 可以使用更短启动超时。
- delegate 不检查 worktree、路径、分支或命令白名单：调用前由外层准备执行空间，任务细节直接写进 `prompt`。

更多见 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 与 codex-cc-reviewer 的区别

`codex-cc-reviewer` 只提供一个窄工具：`cc_review`。

`codex-cc-tools` 保留这个审阅工作流，并增加一个自主执行入口：

- `cc_review`：第二意见审阅
- `cc_delegate`：由 prompt 驱动的 Claude Code 执行，可按任务范围只读或写入

Provider routing 与 task 正交。DeepSeek 不是一个任务，而是通过 `providerProfile: "deepseek"` 选择的后端。

## 文档

- [安装](docs/installation.md)
- [工具契约](docs/tool-contract.md)
- [安全说明](docs/security.md)
- [delegate 边界](docs/delegate-safety.md)
- [故障排查](docs/troubleshooting.md)
- [架构](docs/architecture.md)
- [相关项目](docs/prior-art.md)
- [示例](examples)

## License

[MIT](LICENSE)
