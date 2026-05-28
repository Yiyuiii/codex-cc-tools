# 更新日志

## [0.3.0-beta.1] - 2026-05-29

- `cc_review` 使用 `providerProfile: "ark_coding_plan"` 时，若调用方没有显式提供
  `tools`，不再默认传入 Claude Code 的 `--allowedTools default`。
- 非 Ark 的 `cc_review` 行为保持不变：Anthropic 和 DeepSeek 仍默认使用
  `tools: ["default"]`。
- Ark 显式传入工具时仍会保留，例如 `tools: "default"`，调用方仍可主动进入
  Claude Code tools 路径。
- 增加回归测试，覆盖 Ark 默认省略 tools 和显式 tools 保留两种行为。

## [0.3.0-beta.0] - 2026-05-28

- 新增显式 `ark_coding_plan` provider profile，用于火山方舟 Ark Coding Plan。
- Ark Coding Plan 通过兼容 Anthropic 协议的 Claude Code 端点 `https://ark.cn-beijing.volces.com/api/coding` 路由。
- Ark 凭据读取顺序为 `ARK_API_KEY`、`VOLCENGINE_API_KEY`；provider token 只注入 Claude Code 子进程，返回结果中会尽力脱敏。
- Ark profile 中，常见 Claude Code 别名 `opus`、`sonnet`、`haiku` 以及 `Doubao-Seed-2.0-pro` 映射到 `doubao-seed-2.0-pro`。
- 为新 provider profile 扩展 `doctor`、CLI help、schema、测试、README、文档和 examples。
- `cc_delegate` 仍默认使用 `providerProfile: "deepseek"`；Ark Coding Plan 需要显式选择。
- 包含 `0.2.1-beta.1` 之后准备的 install/uninstall CLI、可操作 doctor 诊断、成熟度文档和包发布面更新。

## [0.2.1-beta.1] - 2026-05-22

- 根据维护者反馈优化 `cc_delegate` MCP 描述。
- 移除可能被理解为工具级并行调用限制的措辞。
- 描述实际机制：一次调用启动一个 DeepSeek 默认的 Claude Code 子进程。
- 文档化并行来自同时发起多个独立的 `cc_delegate` 调用。

## [0.2.1-beta.0] - 2026-05-22

- `cc_delegate` 默认使用 `providerProfile: "deepseek"`。
- 将 `cc_delegate` 定位为低成本的 DeepSeek V4 Pro 子任务工作者。
- 文档化 destructive MCP metadata 反映可写能力；prompt 仍可请求只读调查。
- 记录维护者意图：将 `cc_delegate` 视为常规工作者，而非仅用于高风险场景。
- 为独立或只读工作启用并行 `cc_delegate` 调用。

## [0.2.0] - 2026-05-22

- 稳定版发布，基于 Codex 端验证后推广 `0.2.0-beta.0`。
- 稳定公开工具面：`cc_review`（只读审查）和 `cc_delegate`（自主执行）。
- `cc_delegate` 接受一个完整 `prompt` 加可选的进程/模型设置。
- 以 Claude Code `bypassPermissions` 非交互模式运行 `cc_delegate`。
- 执行空间、分支、容器、路径和命令策略仍属于 MCP 工具外部。

## [0.2.0-beta.0] - 2026-05-22

- **破坏性变更**：移除公开的 `cc_research` 和 `cc_verify` MCP 工具及对应 CLI 命令。
- 保留 `cc_review` 作为只读审查路径。
- 将 `cc_delegate` 转变为自主执行路径。
- 移除 `delegate` 的 `context`、`acceptanceCriteria`、执行隔离、路径策略和命令策略字段。
- 文档化执行空间和命令策略为外部调用者职责。

## [0.1.0] - 2026-05-22

- 首个稳定 npm `latest` 发布，通过 GitHub Actions Trusted Publishing。
- CLI 和 MCP 入口：`review`、`research`、`verify`、`delegate`。
- DeepSeek provider profile 支持已实现的 `review` 任务，含路由诊断。
- DeepSeek 审查可靠性门通过：15/15 结构化输出，0 遗漏已知发现。
- GitHub Actions CI 和发布工作流基于 `codex-cc-reviewer` 发布模式。

## [0.1.0-beta.1] - 2026-05-22

- 验证 GitHub bot 发布路径，继手动引导 `0.1.0-beta.0` 之后。
- 在 `package.json` 中声明 GitHub 仓库 URL 以支持 npm Trusted Publishing。

## [0.1.0-beta.0] - 2026-05-22

- 首个 npm `next` 预发布，通过 GitHub Actions Trusted Publishing。
- 包二进制入口：CLI（`codex-cc-tools`）和专用 MCP server（`codex-cc-tools-mcp`）。
- Provider profiles：`anthropic`（原生 Claude Code 认证）和 `deepseek`（Anthropic 兼容端点）。
- 任务注册表含 `review`、`research`、`verify`、`delegate`。

## [0.0.0] - 2026-05-22

- Milestone 7 打包和发布准备后的发布前状态。
- 包已准备好本地安装、MCP server 使用和发布冒烟检查。
- 未执行 `npm publish`；此版本为验证检查点。
