#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const requiredPackFiles = [
  "dist/index.js",
  "dist/mcp-server.js",
  "AGENTS.md",
  "README.md",
  "README.zh-CN.md",
  "docs/installation.md",
  "docs/tool-contract.md",
  "docs/security.md",
  "docs/delegate-safety.md",
  "docs/troubleshooting.md",
  "docs/prior-art.md",
  "examples/codex-config.md",
  "examples/mcp-config.json"
];

for (const file of ["dist/index.js", "dist/mcp-server.js"]) {
  if (!existsSync(file)) {
    fail(`${file} is missing. Run npm run build first.`);
  }
}

run("node", ["dist/index.js", "--version"]);
run("node", ["dist/index.js", "--help"]);
run("node", ["dist/index.js", "doctor"]);

await checkMcpToolRegistration();

const pack = run("npm", ["pack", "--dry-run", "--json"]);
const parsed = JSON.parse(pack.stdout.replace(/^[\uFEFF\s]+/, ""));
if (!Array.isArray(parsed) || !Array.isArray(parsed[0]?.files)) {
  fail("npm pack --dry-run --json returned an unexpected shape.");
}
const files = new Set((parsed[0]?.files ?? []).map((file) => file.path));
const missing = requiredPackFiles.filter((file) => !files.has(file));
if (missing.length) {
  fail(`npm pack dry-run is missing expected files:\n${missing.map((file) => `- ${file}`).join("\n")}`);
}

process.stdout.write(`release smoke ok: ${files.size} packaged files checked\n`);

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { encoding: "utf8" });
  if (result.status !== 0) {
    fail(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.error?.message,
        result.stdout?.trim(),
        result.stderr?.trim()
      ].filter(Boolean).join("\n")
    );
  }
  return result;
}

function resolveCommand(command, args) {
  if (process.platform === "win32" && command === "npm") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "npm", ...args] };
  }
  return { command, args };
}

async function checkMcpToolRegistration() {
  const module = await import(pathToFileURL(`${process.cwd()}/dist/index.js`).href);
  const registrations = new Map();
  const server = {
    registerTool: (name, config, handler) => {
      registrations.set(name, { config, handler });
    }
  };
  module.registerCcReviewTool(server);
  module.registerCcDelegateTool(server);

  for (const expected of ["cc_review", "cc_delegate"]) {
    const registration = registrations.get(expected);
    if (!registration) {
      fail(`MCP tool registration smoke missing ${expected}`);
    }
    const { config, handler } = registration;
    if (!config.inputSchema || !config.outputSchema) {
      fail(`MCP tool registration smoke missing schema for ${expected}`);
    }
    if (typeof handler !== "function") {
      fail(`MCP tool registration smoke missing handler for ${expected}`);
    }
  }

  const expectedAnnotations = new Map([
    ["cc_review", { readOnlyHint: true, destructiveHint: false }],
    ["cc_delegate", { readOnlyHint: false, destructiveHint: true }]
  ]);
  for (const [name, expected] of expectedAnnotations) {
    const annotations = registrations.get(name).config.annotations;
    if (
      annotations?.readOnlyHint !== expected.readOnlyHint ||
      annotations?.destructiveHint !== expected.destructiveHint
    ) {
      fail(
        `MCP tool registration smoke expected ${name} annotations readOnlyHint=${expected.readOnlyHint} destructiveHint=${expected.destructiveHint}.`
      );
    }
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
