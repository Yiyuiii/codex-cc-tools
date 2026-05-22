import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildResearchPacket, readResearchWorkspaceFile } from "../src/tasks/research/packet.js";
import { CcResearchInputSchema } from "../src/tasks/research/schema.js";

describe("buildResearchPacket", () => {
  it("wraps research input in stable read-only packet sections", async () => {
    const packet = await buildResearchPacket(
      CcResearchInputSchema.parse({
        question: "Where is provider routing implemented?",
        context: "Focus on the current repository.",
        includeGitStatus: true,
        includeFiles: ["src/providers/registry.ts"]
      }),
      {
        getGitStatus: async () => " M src/providers/registry.ts",
        readWorkspaceFile: async () => "export const ProviderProfileSchema = z.enum([]);"
      }
    );

    expect(packet).toContain("# Codex to Claude Code Research Packet");
    expect(packet).toContain("Do not edit files.");
    expect(packet).toContain("## Question\n\nWhere is provider routing implemented?");
    expect(packet).toContain("## Context\n\nFocus on the current repository.");
    expect(packet).toContain("## Git Status");
    expect(packet).toContain("## Included Files");
    expect(packet).toContain("src/providers/registry.ts");
  });

  it("keeps packets within maxContextChars and records unreadable files", async () => {
    const packet = await buildResearchPacket(
      CcResearchInputSchema.parse({
        question: "Summarize included files.",
        includeFiles: ["src/large.ts", "src/missing.ts"],
        maxContextChars: 1_200
      }),
      {
        readWorkspaceFile: async (path) => {
          if (path.endsWith("missing.ts")) {
            throw new Error("not found");
          }
          return "large\n".repeat(1_000);
        }
      }
    );

    expect(packet.length).toBeLessThanOrEqual(1_200);
    expect(packet).toContain("[TRUNCATED");
    expect(packet).toContain("## Packet Diagnostics");
    expect(packet).toContain("Could not read src/missing.ts");
  });

  it("rejects included files that escape the workspace after realpath resolution", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-cc-tools-research-"));
    const outside = await mkdtemp(join(tmpdir(), "codex-cc-tools-outside-"));

    try {
      await mkdir(join(root, "links"));
      await writeFile(join(outside, "secret.txt"), "SECRET=outside\n", "utf8");
      try {
        await symlink(join(outside, "secret.txt"), join(root, "links", "secret.txt"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") return;
        throw error;
      }

      await expect(readResearchWorkspaceFile("links/secret.txt", root)).rejects.toThrow(
        "Path escapes workspace"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
