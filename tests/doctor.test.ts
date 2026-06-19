import { describe, expect, it } from "vitest";

import {
  arkCodingPlanEnvResult,
  arkAgentPlanEnvResult,
  backgroundJobsResult,
  claudeCliResult,
  codexCliResult,
  daemonRosterResult,
  deepSeekEnvResult,
  geminiEnvResult,
  mcpRegistrationResult,
  parseClaudeVersion,
  registryResults,
  shouldDoctorFail
} from "../src/cli/doctor.js";
import type { DoctorResult } from "../src/cli/doctor.js";

describe("doctor diagnostics", () => {
  it("fails only for error-level diagnostics", () => {
    const warnOnly: DoctorResult[] = [
      { name: "Codex CLI", ok: false, level: "warn", detail: "not runnable" }
    ];
    const withError: DoctorResult[] = [
      { name: "Codex config", ok: false, level: "error", detail: "missing" }
    ];

    expect(shouldDoctorFail(warnOnly)).toBe(false);
    expect(shouldDoctorFail(withError)).toBe(true);
  });

  it("treats the Codex CLI as optional", () => {
    const result = codexCliResult({
      ok: false,
      command: "codex --version",
      output: "not found"
    });

    expect(result.level).toBe("warn");
    expect(result.detail).toContain("Codex app MCP config may still work");
  });

  it("parses and grades Claude Code CLI versions", () => {
    expect(parseClaudeVersion("node warning 18.19.0\n2.1.140 (Claude Code)")).toBe("2.1.140");

    const missing = claudeCliResult({
      ok: false,
      command: "claude --version",
      output: "not found"
    });
    const old = claudeCliResult({
      ok: true,
      command: "claude --version",
      output: "2.1.91 (Claude Code)"
    });
    const supported = claudeCliResult({
      ok: true,
      command: "claude --version",
      output: "2.1.140 (Claude Code)"
    });

    expect(missing.level).toBe("error");
    expect(old.level).toBe("warn");
    expect(supported.level).toBe("ok");
  });

  it("warns for unreadable daemon roster or mismatched worker versions", () => {
    expect(daemonRosterResult("not json", "2.1.140").level).toBe("warn");

    const result = daemonRosterResult(
      JSON.stringify({
        workers: {
          abc: { cliVersion: "2.1.91" },
          def: { cliVersion: "2.1.140" }
        }
      }),
      "2.1.140"
    );

    expect(result.level).toBe("warn");
    expect(result.detail).toContain("different Claude Code version");
  });

  it("warns for blocked background jobs without failing doctor", () => {
    const result = backgroundJobsResult([
      { name: "blocked1", text: '{"state":"blocked"}' },
      { name: "working1", text: '{"state":"working"}' },
      { name: "badjson", text: '{"state":' }
    ]);

    expect(result.level).toBe("warn");
    expect(result.detail).toContain("blocked1");
    expect(result.detail).toContain("could not be parsed");
    expect(shouldDoctorFail([result])).toBe(false);
  });

  it("reports MCP registration for npx and global config modes", () => {
    const npx = mcpRegistrationResult(
      [
        "[mcp_servers.codex_cc_tools]",
        'command = "npx"',
        'args = ["-y", "codex-cc-tools@next", "mcp"]'
      ].join("\n")
    );
    const global = mcpRegistrationResult(
      [
        "[mcp_servers.codex_cc_tools]",
        'command = "codex-cc-tools-mcp"',
        "args = []"
      ].join("\n")
    );
    const missing = mcpRegistrationResult("");

    expect(npx.level).toBe("ok");
    expect(npx.detail).toContain("codex-cc-tools@next");
    expect(global.level).toBe("ok");
    expect(global.detail).toContain("codex-cc-tools-mcp");
    expect(missing.level).toBe("warn");
    expect(missing.detail).toContain("codex-cc-tools install");
  });

  it("reports DeepSeek env readiness and key precedence", () => {
    expect(deepSeekEnvResult({}).level).toBe("warn");
    expect(deepSeekEnvResult({ OPENAI_API_KEY_DEEPSEEK: "same" }).level).toBe("ok");

    const mismatch = deepSeekEnvResult({
      DEEPSEEK_API_KEY: "one",
      OPENAI_API_KEY_DEEPSEEK: "two"
    });

    expect(mismatch.level).toBe("warn");
    expect(mismatch.detail).toContain("DEEPSEEK_API_KEY wins");
  });

  it("reports Ark Coding Plan env readiness and key precedence", () => {
    expect(arkCodingPlanEnvResult({}).level).toBe("warn");
    expect(arkCodingPlanEnvResult({ VOLCENGINE_API_KEY: "same" }).level).toBe("ok");

    const mismatch = arkCodingPlanEnvResult({
      ARK_API_KEY: "one",
      VOLCENGINE_API_KEY: "two"
    });

    expect(mismatch.level).toBe("warn");
    expect(mismatch.detail).toContain("ARK_API_KEY wins");
  });

  it("reports Ark Agent Plan env readiness", () => {
    expect(arkAgentPlanEnvResult({}).level).toBe("warn");
    expect(arkAgentPlanEnvResult({ OPENAI_API_KEY_DOUBAO: "same" })).toMatchObject({
      level: "ok",
      detail: expect.stringContaining("OPENAI_API_KEY_DOUBAO is set")
    });
  });

  it("reports Gemini env readiness and key precedence", () => {
    expect(geminiEnvResult({}).level).toBe("warn");
    expect(geminiEnvResult({ GEMINI_API_KEY: "same" })).toMatchObject({
      level: "ok",
      detail: expect.stringContaining("GEMINI_API_KEY is set")
    });

    const mismatch = geminiEnvResult({
      GEMINI_API_KEY: "one",
      GOOGLE_API_KEY: "two",
      GOOGLE_GENERATIVE_AI_API_KEY: "three"
    });

    expect(mismatch.level).toBe("warn");
    expect(mismatch.detail).toContain("GEMINI_API_KEY wins");
  });

  it("lists task, provider, and MCP tool names", () => {
    const results = registryResults();
    const details = results.map((result) => result.detail).join("\n");

    expect(details).toContain("review, delegate");
    expect(details).toContain("anthropic, deepseek, ark_coding_plan, ark_agent_plan, gemini");
    expect(details).toContain("cc_review, cc_delegate");
  });
});
