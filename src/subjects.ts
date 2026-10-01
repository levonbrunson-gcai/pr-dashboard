import { findIssueIdentifiers } from "./linear.ts";
import type { Config, Stack, Subject } from "./types.ts";

const unsortedSubject = "Unsorted";

export function stackIssueIdentifiers(stack: Stack, linearTeamKeys: string[]): string[] {
  return stack.flatMap((pullRequest) =>
    findIssueIdentifiers(`${pullRequest.headRefName} ${pullRequest.title} ${pullRequest.body}`, linearTeamKeys),
  );
}

function mostCommon(names: string[]): string | undefined {
  return [...Map.groupBy(names, (name) => name)].sort(([, first], [, second]) => second.length - first.length)[0]?.[0];
}

function subjectForStack(stack: Stack, config: Config, projectByIssue: Map<string, string>): string {
  const override = Object.entries(config.overrides).find(([branchPrefix]) =>
    stack.some((pullRequest) => pullRequest.headRefName.startsWith(branchPrefix)),
  );
  if (override) return override[1];
  const projects = stackIssueIdentifiers(stack, config.linearTeamKeys).flatMap(
    (identifier) => projectByIssue.get(identifier) ?? [],
  );
  return mostCommon(projects) ?? unsortedSubject;
}

export function groupBySubject(stacks: Stack[], config: Config, projectByIssue: Map<string, string>): Subject[] {
  const isUnsorted = (subject: Subject) => Number(subject.name === unsortedSubject);
  return [...Map.groupBy(stacks, (stack) => subjectForStack(stack, config, projectByIssue))]
    .map(([name, subjectStacks]) => ({ name, stacks: subjectStacks }))
    .sort((first, second) => isUnsorted(first) - isUnsorted(second) || first.name.localeCompare(second.name));
}
