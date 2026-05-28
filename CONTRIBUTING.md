# Contributing

## Development Setup

```bash
git clone https://github.com/Yiyuiii/codex-cc-tools.git
cd codex-cc-tools
npm install
npm run build
```

## Standard Checks

Before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js --version
node dist/index.js --help
```

## Conventions

- TypeScript with ES modules.
- TDD for behavior-bearing code. Tests live in `tests/`.
- `npm run verify:release` runs typecheck, tests, build, and release smoke checks.
- Keep the public surface small: `cc_review` and `cc_delegate` are the only
  committed public MCP tools.
- Provider profiles (`anthropic`, `deepseek`) are orthogonal to tasks. Do not
  bake a provider into a task definition.

## Commit Style

Follow the existing conventions visible in `git log`. Write commits that
explain *why*, not just *what*.

## Pull Requests

- Open PRs against `next` for prerelease work, `main` for stable-only fixes.
- Run `npm run verify:release` before requesting review.
- Keep changes focused; split unrelated work into separate PRs.
