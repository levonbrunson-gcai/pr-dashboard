import type { PullRequest, Stack } from "./types.ts";

const branchKey = (repository: string, branch: string) => `${repository}:${branch}`;

export function buildStacks(pullRequests: PullRequest[]): Stack[] {
  const heads = new Set(pullRequests.map((pullRequest) => branchKey(pullRequest.repository, pullRequest.headRefName)));
  const childrenByBase = Map.groupBy(pullRequests, (pullRequest) =>
    branchKey(pullRequest.repository, pullRequest.baseRefName),
  );
  const collect = (pullRequest: PullRequest): Stack => [
    pullRequest,
    ...(childrenByBase.get(branchKey(pullRequest.repository, pullRequest.headRefName)) ?? []).flatMap(collect),
  ];
  return pullRequests
    .filter((pullRequest) => !heads.has(branchKey(pullRequest.repository, pullRequest.baseRefName)))
    .map(collect);
}

function commonPrefix(first: string, second: string): string {
  let length = 0;
  while (length < first.length && first[length] === second[length]) length++;
  return first.slice(0, length);
}

export function stackName(stack: Stack): string {
  const branches = stack.map((pullRequest) => pullRequest.headRefName);
  const prefix = branches.reduce(commonPrefix);
  const wholeWords = branches.includes(prefix) ? prefix : prefix.replace(/[^-/]*$/, "");
  return wholeWords.replace(/[-/]+$/, "") || branches[0];
}
