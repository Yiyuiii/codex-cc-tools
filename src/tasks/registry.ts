export type TaskSafety = "readonly" | "workspace-write" | "command-exec";

export interface TaskDefinition {
  name: "review" | "delegate" | "verify" | "research";
  capability: string;
  safety: TaskSafety;
}

const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    name: "review",
    capability: "Read-only external review of plans, diffs, and documents",
    safety: "readonly"
  },
  {
    name: "delegate",
    capability: "Writable delegated subtasks executed by Claude Code",
    safety: "workspace-write"
  },
  {
    name: "verify",
    capability: "Focused verification and reproduction tasks",
    safety: "command-exec"
  },
  {
    name: "research",
    capability: "Read-only repository and context investigation",
    safety: "readonly"
  }
];

export function getTaskDefinitions(): TaskDefinition[] {
  return TASK_DEFINITIONS.map((task) => ({ ...task }));
}
