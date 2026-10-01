import { plural } from "./format.ts";
import type { PullRequest } from "./types.ts";

export type Status =
  | { kind: "onYou"; reasons: string[] }
  | { kind: "waitingOnReviewer"; reviewers: string[] }
  | { kind: "waitingOnCi" }
  | { kind: "readyToMerge" };

export function pullRequestStatus(pullRequest: PullRequest): Status {
  const ciRunning = pullRequest.checkState === "PENDING" || pullRequest.checkState === "EXPECTED";
  const reasons = [
    pullRequest.isDraft ? "Draft" : "",
    pullRequest.checkState === "FAILURE" || pullRequest.checkState === "ERROR" ? "CI failing" : "",
    pullRequest.reviewDecision === "CHANGES_REQUESTED" ? "Changes requested" : "",
    pullRequest.humanThreadCount > 0 ? plural(pullRequest.humanThreadCount, "open thread") : "",
  ].filter(Boolean);
  if (reasons.length > 0) return { kind: "onYou", reasons };
  if (pullRequest.reviewDecision === "APPROVED" && !ciRunning) return { kind: "readyToMerge" };
  if (pullRequest.requestedReviewers.length > 0) {
    return { kind: "waitingOnReviewer", reviewers: pullRequest.requestedReviewers };
  }
  if (ciRunning) return { kind: "waitingOnCi" };
  return { kind: "onYou", reasons: ["Needs a reviewer"] };
}
