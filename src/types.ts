export type PullRequest = {
  number: number;
  title: string;
  url: string;
  body: string;
  isDraft: boolean;
  baseRefName: string;
  headRefName: string;
  author: string;
  cursorAgentUrl: string | null;
  repository: string;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  checkState: "SUCCESS" | "FAILURE" | "ERROR" | "PENDING" | "EXPECTED" | null;
  requestedReviewers: string[];
  humanThreadCount: number;
  botThreadCount: number;
};

export type Stack = PullRequest[];

export type Subject = { name: string; stacks: Stack[] };

export type Config = {
  linearTeamKeys: string[];
  overrides: Record<string, string>;
};
