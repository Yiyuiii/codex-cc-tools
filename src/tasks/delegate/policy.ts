import path from "node:path";
import { realpathSync } from "node:fs";
import { readdir } from "node:fs/promises";

import { execa } from "execa";

import {
  isPathEqualOrInside,
  isPathInsideBoundary,
  isUnsafeWorkspaceRoot
} from "../../core/workspace-boundary.js";
import type { CcDelegateInput } from "./schema.js";

type PlatformName = NodeJS.Platform | "win32" | "linux" | "darwin";

const DEFAULT_DELEGATE_TOOLS = ["Read", "Grep", "Glob", "LS", "Edit", "Write"];
const PROTECTED_BRANCHES = new Set(["main", "master", "develop", "trunk", "prod", "production"]);

export interface DelegatePolicyDeps {
  platform?: PlatformName;
  env?: Record<string, string | undefined>;
  realpath?: (value: string) => string;
  git?: {
    isLinkedWorktree?: boolean;
    isBare?: boolean;
    currentBranch?: string;
    headSha?: string;
    dirtyStatus?: string[];
    remoteDefaultBranches?: string[];
    executableHooks?: string[];
  };
}

export interface DelegatePolicyResult {
  ok: boolean;
  diagnostics: string[];
  tools: string[];
  permissionMode: "acceptEdits";
  resolvedCwd?: string;
  allowedPaths?: string[];
  forbiddenPaths?: string[];
}

export interface ValidateChangedPathsInput {
  cwd: string;
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  changedPaths: string[];
  platform?: PlatformName;
  realpath?: (value: string) => string;
}

export async function collectDelegateChangedPaths(cwd: string): Promise<string[] | undefined> {
  const result = await execa(
    "git",
    ["-c", "core.hooksPath=/dev/null", "status", "--porcelain=v1"],
    { cwd, reject: false }
  );
  if (result.exitCode !== 0) return undefined;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((line) => line.replace(/^"|"$/g, ""))
    .map((line) => (line.includes(" -> ") ? line.split(" -> ").at(-1) ?? line : line));
}

export async function collectDelegatePolicyDeps(cwd: string): Promise<DelegatePolicyDeps> {
  const gitDir = await gitOutput(cwd, ["-c", "core.hooksPath=/dev/null", "rev-parse", "--git-dir"]);
  const gitCommonDir = await gitOutput(cwd, [
    "-c",
    "core.hooksPath=/dev/null",
    "rev-parse",
    "--git-common-dir"
  ]);
  const superproject = await gitOutput(cwd, [
    "-c",
    "core.hooksPath=/dev/null",
    "rev-parse",
    "--show-superproject-working-tree"
  ]);
  const isBare = await gitOutput(cwd, [
    "-c",
    "core.hooksPath=/dev/null",
    "rev-parse",
    "--is-bare-repository"
  ]);
  const remoteHeads = await gitOutput(cwd, [
    "-c",
    "core.hooksPath=/dev/null",
    "for-each-ref",
    "--format=%(symref:short)",
    "refs/remotes/*/HEAD"
  ]);
  const hooksPath = await gitOutput(cwd, ["-c", "core.hooksPath=/dev/null", "rev-parse", "--git-path", "hooks"]);
  const currentBranch = await gitOutput(cwd, [
    "-c",
    "core.hooksPath=/dev/null",
    "rev-parse",
    "--abbrev-ref",
    "HEAD"
  ]);
  const headSha = await gitOutput(cwd, ["-c", "core.hooksPath=/dev/null", "rev-parse", "HEAD"]);
  const dirtyStatus = await collectDelegateChangedPaths(cwd);

  return {
    realpath: safeRealpath,
    git: {
      isLinkedWorktree: Boolean(gitDir && gitCommonDir && gitDir !== gitCommonDir && !superproject),
      isBare: isBare === "true",
      currentBranch: currentBranch || undefined,
      headSha: headSha || undefined,
      dirtyStatus,
      remoteDefaultBranches: parseRemoteDefaultBranches(remoteHeads),
      executableHooks: hooksPath ? await listNonSampleHooks(path.resolve(cwd, hooksPath)) : []
    }
  };
}

export function evaluateDelegatePolicy(
  input: CcDelegateInput,
  deps: DelegatePolicyDeps = {}
): DelegatePolicyResult {
  const platform = deps.platform ?? process.platform;
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const realpath = deps.realpath ?? ((value: string) => value);
  const diagnostics: string[] = [];
  const resolvedCwd = realpath(pathModule.resolve(input.cwd));

  if (isUnsafeWorkspaceRoot(resolvedCwd, deps.env, platform)) {
    diagnostics.push(`Delegate cwd is an unsafe workspace root: ${resolvedCwd}`);
  }

  const isolationDiagnostics = validateIsolation(input, deps);
  diagnostics.push(...isolationDiagnostics);

  const allowed = resolvePathList("allowedPaths", input.allowedPaths, resolvedCwd, platform, realpath);
  const forbidden = resolvePathList("forbiddenPaths", input.forbiddenPaths, resolvedCwd, platform, realpath);
  diagnostics.push(...allowed.diagnostics, ...forbidden.diagnostics);
  const commandDiagnostics = validateDelegateCommands(input.commandsAllowed ?? []);
  diagnostics.push(...commandDiagnostics);

  if (!input.commandsAllowed?.length && taskAppearsToRequireShell(input.task)) {
    diagnostics.push("Delegate task appears to require shell execution but commandsAllowed is absent.");
  }

  if (deps.git?.executableHooks?.length) {
    diagnostics.push(
      `.git/hooks contains executable hooks that are not allowed for delegate: ${deps.git.executableHooks.join(", ")}`
    );
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    tools: [
      ...DEFAULT_DELEGATE_TOOLS,
      ...(input.commandsAllowed ?? []).map((command) => `Bash(${command})`)
    ],
    permissionMode: "acceptEdits",
    resolvedCwd,
    allowedPaths: allowed.paths,
    forbiddenPaths: forbidden.paths
  };
}

export function validateDelegateChangedPaths(input: ValidateChangedPathsInput): {
  ok: boolean;
  diagnostics: string[];
} {
  const platform = input.platform ?? process.platform;
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const realpath = input.realpath ?? ((value: string) => value);
  const resolvedCwd = realpath(pathModule.resolve(input.cwd));
  const allowedPaths = input.allowedPaths ?? [];
  const forbiddenPaths = input.forbiddenPaths ?? [];
  const diagnostics: string[] = [];

  for (const changedPath of input.changedPaths) {
    if (hasShellPathSyntax(changedPath)) {
      diagnostics.push(`Changed path uses shell or environment variable syntax: ${changedPath}`);
      continue;
    }

    const absolute = pathModule.isAbsolute(changedPath)
      ? changedPath
      : pathModule.resolve(resolvedCwd, changedPath);
    const resolvedChangedPath = realpath(absolute);

    if (isGitInternalPath(resolvedChangedPath, resolvedCwd, platform)) {
      diagnostics.push(`Changed path targets Git internals: ${changedPath}`);
      continue;
    }

    if (!isPathEqualOrInside(resolvedChangedPath, resolvedCwd, platform)) {
      diagnostics.push(`Changed path resolves outside workspace: ${changedPath}`);
      continue;
    }

    if (allowedPaths.length && !isPathInsideBoundary(resolvedChangedPath, allowedPaths, platform)) {
      diagnostics.push(`Changed path is outside allowed paths: ${changedPath}`);
    }

    if (forbiddenPaths.some((forbidden) => isPathEqualOrInside(resolvedChangedPath, forbidden, platform))) {
      diagnostics.push(`Changed path is inside forbidden paths: ${changedPath}`);
    }
  }

  return { ok: diagnostics.length === 0, diagnostics };
}

function validateIsolation(input: CcDelegateInput, deps: DelegatePolicyDeps): string[] {
  const diagnostics: string[] = [];
  const remoteDefaultBranches = deps.git?.remoteDefaultBranches ?? [];
  const declaredBranch =
    input.isolation.kind === "container" ? undefined : input.isolation.branch;
  const runtimeBranch = deps.git?.currentBranch;
  const branch = runtimeBranch && runtimeBranch !== "HEAD" ? runtimeBranch : declaredBranch;

  if (branch && isProtectedBranch(branch, remoteDefaultBranches)) {
    diagnostics.push(`Delegate isolation targets a protected branch: ${branch}`);
  }

  if (input.isolation.kind === "git-worktree") {
    if (!input.isolation.branch && !input.isolation.acceptDetached) {
      diagnostics.push("git-worktree isolation requires a branch or acceptDetached: true.");
    }
    if (input.isolation.branch && runtimeBranch && runtimeBranch !== "HEAD" && runtimeBranch !== input.isolation.branch) {
      diagnostics.push(`git-worktree isolation branch mismatch: declared ${input.isolation.branch}, runtime ${runtimeBranch}.`);
    }
    if (deps.git?.isLinkedWorktree === undefined) {
      diagnostics.push("git-worktree isolation could not verify linked worktree metadata.");
    } else if (!deps.git.isLinkedWorktree) {
      diagnostics.push("git-worktree isolation requires a linked worktree.");
    }
    if (deps.git?.isBare === undefined) {
      diagnostics.push("git-worktree isolation could not verify non-bare worktree metadata.");
    } else if (deps.git.isBare) {
      diagnostics.push("git-worktree isolation cannot use a bare worktree.");
    }
  }

  if (input.isolation.kind === "git-branch" && runtimeBranch && runtimeBranch !== input.isolation.branch) {
    diagnostics.push(`git-branch isolation branch mismatch: declared ${input.isolation.branch}, runtime ${runtimeBranch}.`);
  }

  const dirtyStatus = deps.git?.dirtyStatus ?? [];
  const acceptsDirty =
    input.isolation.kind !== "container" && Boolean(input.isolation.acceptDirty);
  if (dirtyStatus.length && !acceptsDirty) {
    diagnostics.push(`Delegate workspace is dirty and acceptDirty is not set: ${dirtyStatus.join(", ")}`);
  }

  return diagnostics;
}

function isProtectedBranch(branch: string, remoteDefaultBranches: string[]): boolean {
  const normalized = branch.toLowerCase();
  return (
    PROTECTED_BRANCHES.has(normalized) ||
    normalized.startsWith("release/") ||
    normalized.startsWith("releases/") ||
    normalized.startsWith("hotfix/") ||
    remoteDefaultBranches.map((item) => item.toLowerCase()).includes(normalized)
  );
}

export function validateDelegateCommands(commands: string[]): string[] {
  const diagnostics: string[] = [];

  for (const command of commands) {
    const normalized = command.trim().toLowerCase();
    if (isPackageInstallCommand(normalized)) {
      diagnostics.push(`Delegate command is package installation or download-execute authority: ${command}`);
    }
    if (normalized.startsWith("git ") && !normalized.includes("-c core.hookspath=")) {
      diagnostics.push(`Delegate git commands must disable hooks with -c core.hooksPath=...: ${command}`);
    }
    if (/\bgit\b[^;&|]*\b(push|remote\s+(add|remove|set-url)|config\s+--global)\b/.test(normalized)) {
      diagnostics.push(`Delegate command mutates remotes or global git configuration: ${command}`);
    }
  }

  return diagnostics;
}

export function validateReportedDelegateCommands(
  reportedCommands: string[],
  allowedCommands: string[] | undefined
): string[] {
  const diagnostics = validateDelegateCommands(reportedCommands);
  const allowed = (allowedCommands ?? []).map((command) => command.trim()).filter(Boolean);

  for (const command of reportedCommands) {
    const normalized = command.trim();
    if (hasShellControlSyntax(normalized)) {
      diagnostics.push(`Delegate reported command contains shell control syntax: ${command}`);
    }
    if (allowedCommands === undefined) {
      diagnostics.push(`Delegate reported command but commandsAllowed was not declared: ${command}`);
      continue;
    }
    if (!allowed.length) {
      diagnostics.push(`Delegate reported command but commandsAllowed is empty: ${command}`);
      continue;
    }
    if (!allowed.some((allowedCommand) => isCommandUnderAllowedPrefix(normalized, allowedCommand))) {
      diagnostics.push(`Delegate reported command is not allowed by commandsAllowed: ${command}`);
    }
  }

  return diagnostics;
}

function isGitInternalPath(pathname: string, cwd: string, platform: PlatformName): boolean {
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const relative = pathModule.relative(cwd, pathname);
  return relative === ".git" || relative.startsWith(`.git${pathModule.sep}`);
}

function safeRealpath(value: string): string {
  try {
    return realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

function isPackageInstallCommand(command: string): boolean {
  return (
    /\b(npm|pnpm|yarn)\s+(install|add)\b/.test(command) ||
    /\b(pip|pipx)\s+install\b/.test(command) ||
    /\b(cargo|go|gem|brew)\s+install\b/.test(command) ||
    /\b(apt|apt-get|dnf|yum|zypper|pacman|choco|scoop|winget)\b/.test(command) ||
    /\b(curl|wget)\b.*(\||\s-o\s|\s--output\s)/.test(command)
  );
}

function taskAppearsToRequireShell(task: string): boolean {
  return /\b(run|execute|command|shell|npm|pnpm|yarn|pytest|vitest|build|test)\b/i.test(task);
}

function resolvePathList(
  name: "allowedPaths" | "forbiddenPaths",
  values: string[] | undefined,
  cwd: string,
  platform: PlatformName,
  realpath: (value: string) => string
): { paths?: string[]; diagnostics: string[] } {
  if (!values?.length) return { diagnostics: [] };
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const paths: string[] = [];
  const diagnostics: string[] = [];
  for (const value of values) {
    if (hasShellPathSyntax(value)) {
      diagnostics.push(`${name} entry uses shell or environment variable syntax: ${value}`);
      continue;
    }

    if (/[*?[\]{}]/.test(value)) {
      diagnostics.push(`${name} entries do not support glob syntax: ${value}`);
      continue;
    }

    let resolved: string;
    try {
      resolved = realpath(pathModule.isAbsolute(value) ? value : pathModule.resolve(cwd, value));
    } catch (error) {
      diagnostics.push(`${name} entry could not be resolved with realpath: ${value}`);
      continue;
    }
    if (!isPathEqualOrInside(resolved, cwd, platform)) {
      diagnostics.push(`${name} entry resolves outside workspace: ${value}`);
      continue;
    }
    if (isGitInternalPath(resolved, cwd, platform)) {
      diagnostics.push(`${name} entry targets Git internals: ${value}`);
      continue;
    }
    paths.push(resolved);
  }
  return { paths: paths.length ? paths : undefined, diagnostics };
}

function isCommandUnderAllowedPrefix(command: string, allowedCommand: string): boolean {
  return command === allowedCommand || command.startsWith(`${allowedCommand} `);
}

function hasShellControlSyntax(command: string): boolean {
  return /[`&|;<>]|\$\(|\r|\n/.test(command);
}

function hasShellPathSyntax(value: string): boolean {
  if (value === "~" || value.startsWith("~/") || value.startsWith("~\\") || /^~[^/\\]/.test(value)) {
    return true;
  }
  const segments = value.split(/[\\/]+/);
  return segments.some((segment) => isEnvironmentPathSegment(segment));
}

function isEnvironmentPathSegment(segment: string): boolean {
  const commonEnvNames = [
    "HOME",
    "USERPROFILE",
    "HOMEDRIVE",
    "HOMEPATH",
    "WINDIR",
    "SYSTEMROOT",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)"
  ];
  const upper = segment.toUpperCase();
  return commonEnvNames.some(
    (name) =>
      upper === `%${name}%` ||
      upper.startsWith(`%${name}%`) ||
      upper === `$${name}` ||
      upper === `\${${name}}` ||
      upper === `$ENV:${name}`
  );
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const result = await execa("git", args, { cwd, reject: false });
  return result.exitCode === 0 ? result.stdout.trim() : "";
}

function parseRemoteDefaultBranches(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("/").slice(1).join("/"))
    .filter(Boolean);
}

async function listNonSampleHooks(hooksPath: string): Promise<string[]> {
  try {
    const entries = await readdir(hooksPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.endsWith(".sample"));
  } catch {
    return [];
  }
}
