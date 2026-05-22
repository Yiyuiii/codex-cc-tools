export type TaskSafety = "readonly" | "destructive";

export interface TaskDefinition {
  name: "review" | "delegate";
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
    capability: "Thin Claude Code prompt execution for Codex",
    safety: "destructive"
  }
];

export function getTaskDefinitions(): TaskDefinition[] {
  return TASK_DEFINITIONS.map((task) => ({ ...task }));
}
