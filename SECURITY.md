# Security Policy

## Reporting a Vulnerability

To report a security vulnerability, use the **GitHub Security Advisory** workflow
on the [Security tab](https://github.com/Yiyuiii/codex-cc-tools/security/advisories)
of this repository.

We prefer **private disclosure** through GitHub Security Advisory so that a fix
can be prepared and published before the vulnerability is publicly described.
Please include:

- A clear description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Suggested remediation if you have one.

We aim to acknowledge reports within 72 hours and publish a coordinated
disclosure after a fix has been shipped.

## Coordinated Disclosure

For confirmed vulnerabilities, we will:

1. Prepare and test a fix in a private branch.
2. Publish the fix through a regular release.
3. Publish a GitHub Security Advisory describing the issue, the fix, and the
   affected version range.
4. Credit the reporter unless they request anonymity.

## Supported Versions

| Version | Supported |
| --- | --- |
| latest stable | Yes |
| `@next` prereleases | Security fixes only |
| older than latest stable | No |

## cc_delegate Security Boundary

`cc_delegate` is a thin Claude Code execution bridge. It starts Claude Code in
non-interactive `bypassPermissions` mode so delegated prompts can run autonomously
without stalling on permission prompts. This means:

- **Execution-space responsibility belongs to the caller.** `cc_delegate` does not
  create, inspect, or enforce worktrees, containers, temporary directories,
  branch policies, or command policies. The caller must prepare the execution
  space before invoking the tool.
- **The tool trusts the caller's environment.** Claude Code inherits the caller's
  file system access, environment variables, and process permissions.
- **No isolation is provided by the tool.** If a delegated task should be
  sandboxed, the caller must set up a worktree, container, VM, or OS-level
  boundary before calling `cc_delegate`.
- **Provider tokens are redacted on a best-effort basis** from returned output,
  but secrets should never be placed in prompts, repository files, or command
  output.
- **Parallel `cc_delegate` calls share no state** beyond the working directory
  they are pointed at. Each call starts a separate Claude Code subprocess with
  its own environment.

Use `cc_delegate` in repositories and directories you own and trust. For shared,
sensitive, or untrusted repositories, restrict tool access or apply OS-level
sandboxing.

## Provider Security

Details on provider environment inheritance, DeepSeek / Ark child-process
routing, Gemini direct review routing, and provider-token redaction are
documented in [docs/security.md](docs/security.md).
