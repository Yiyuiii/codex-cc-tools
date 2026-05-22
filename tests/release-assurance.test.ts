import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageJson {
  bin?: Record<string, string>;
  files?: string[];
  repository?: { type?: string; url?: string };
  scripts?: Record<string, string>;
  version?: string;
}

const root = process.cwd();

describe("release assurance", () => {
  it("publishes separate CLI and MCP server binaries", () => {
    const pkg = readPackageJson();

    expect(pkg.bin).toMatchObject({
      "codex-cc-tools": "dist/index.js",
      "codex-cc-tools-mcp": "dist/mcp-server.js"
    });
    expect(pkg.scripts?.build).toContain("src/mcp-server.ts");
  });

  it("keeps release docs, examples, and smoke script in the package surface", () => {
    const pkg = readPackageJson();
    const releaseSmoke = readFileSync(join(root, "scripts", "release-smoke.mjs"), "utf8");

    expect(pkg.files).toEqual(
      expect.arrayContaining(["dist", "AGENTS.md", "README.md", "README.zh-CN.md", "docs", "examples"])
    );
    expect(pkg.scripts?.["release:smoke"]).toContain("npm run build");
    expect(pkg.scripts?.["release:smoke"]).toContain("node scripts/release-smoke.mjs");
    expect(exists("scripts/release-smoke.mjs")).toBe(true);
    // Guard against the Windows Node warning caused by spawnSync with shell execution.
    expect(releaseSmoke).not.toContain("shell:");
    expect(releaseSmoke).toContain("registerCcReviewTool");
    expect(releaseSmoke).toContain("registerCcDelegateTool");
    expect(releaseSmoke).toContain("destructiveHint");
    expect(releaseSmoke).toContain("readOnlyHint");
    expect(releaseSmoke).toContain("typeof handler");
    expect(releaseSmoke).toContain("examples/codex-config.md");
    expect(releaseSmoke).toContain("docs/delegate-safety.md");
  });

  it("exposes release verification scripts for CI and tag publishing", () => {
    const pkg = readPackageJson();

    expect(pkg.scripts?.["verify:release"]).toContain("npm run typecheck");
    expect(pkg.scripts?.["verify:release"]).toContain("npm test");
    expect(pkg.scripts?.["verify:release"]).toContain("npm run release:smoke");
    expect(pkg.scripts?.preflight).toContain("npm ci");
    expect(pkg.scripts?.preflight).toContain("npm run verify:release");
  });

  it("declares the GitHub repository used by npm trusted publishing", () => {
    const pkg = readPackageJson();

    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/Yiyuiii/codex-cc-tools.git"
    });
  });

  it("keeps CLI and MCP server version in sync with package metadata", () => {
    const pkg = readPackageJson();
    const versionSource = readFileSync(join(root, "src", "version.ts"), "utf8");
    const mcpServerSource = readFileSync(join(root, "src", "mcp", "server.ts"), "utf8");

    expect(versionSource).toContain(`VERSION = "${pkg.version}"`);
    expect(mcpServerSource).toContain('import { VERSION } from "../version.js"');
    expect(mcpServerSource).toContain("version: VERSION");
  });

  it("ships maintainer-facing release documentation", () => {
    for (const file of [
      "README.zh-CN.md",
      "docs/installation.md",
      "docs/tool-contract.md",
      "docs/troubleshooting.md",
      "docs/prior-art.md",
      "examples/codex-config.md",
      "examples/mcp-config.json"
    ]) {
      expect(exists(file), `${file} should exist`).toBe(true);
    }
  });

  it("provides an MCP config example for the dedicated MCP binary", () => {
    const example = JSON.parse(readFileSync(join(root, "examples", "mcp-config.json"), "utf8")) as {
      mcpServers?: Record<string, { command?: string; args?: string[] }>;
    };

    expect(example.mcpServers?.["codex-cc-tools"]).toMatchObject({
      command: "codex-cc-tools-mcp",
      args: []
    });
  });

  it("does not ship maintainer-local absolute paths in examples", () => {
    const example = readFileSync(join(root, "examples", "codex-config.md"), "utf8");

    expect(example).not.toContain("D:/Codes");
    expect(example).not.toContain("D:\\Codes");
  });

  it("runs CI on main and next with package smoke evidence", () => {
    const workflow = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");

    expect(workflow).toContain("branches: [main, next]");
    expect(workflow).toContain("node-version: [20, 22, 24]");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run release:smoke");
    expect(workflow).toContain("actions/upload-artifact");
  });

  it("publishes through GitHub trusted publishing with next for prereleases", () => {
    const workflow = readFileSync(join(root, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("tags:");
    expect(workflow).toContain('"v*"');
    expect(workflow).toContain("npm_tag=next");
    expect(workflow).toContain("required_branch=origin/next");
    expect(workflow).toContain("npm_tag=latest");
    expect(workflow).toContain("required_branch=origin/main");
    expect(workflow).toContain("Verify package version matches tag");
    expect(workflow).toContain("Verify tag ancestry");
    expect(workflow).toContain("Verify stable release validation evidence");
    expect(workflow).toContain("npm publish --ignore-scripts --provenance");
    expect(workflow).toContain('npm view "codex-cc-tools@${version}" version');
    expect(workflow).toContain("github-release:");
    expect(workflow).toContain("Create or update GitHub Release");
  });

  it("normalizes stable release validation evidence files to LF", () => {
    const attributes = readFileSync(join(root, ".gitattributes"), "utf8");

    expect(attributes).toContain(".release-validation/*.md text eol=lf");
  });
});

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageJson;
}

function exists(pathname: string): boolean {
  return existsSync(join(root, pathname));
}
