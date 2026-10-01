import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PullRequest } from "./types.ts";

const execFileAsync = promisify(execFile);

const query = `fragment PullRequestFields on PullRequest {
  number title url body isDraft baseRefName headRefName reviewDecision
  author { login }
  repository { nameWithOwner }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  reviewRequests(first: 20) {
    nodes { requestedReviewer { ... on User { login } ... on Bot { login } ... on Mannequin { login } ... on Team { name } } }
  }
  latestReviews(first: 20) { nodes { state author { __typename } } }
  reviewThreads(first: 50) { nodes { isResolved comments(first: 1) { nodes { author { __typename login } } } } }
}

query {
  viewer {
    login
    pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes { ...PullRequestFields }
    }
  }
  search(query: "is:open is:pr archived:false user-review-requested:@me", type: ISSUE, first: 20) {
    nodes { ...PullRequestFields }
  }
}`;

type Author = { __typename: string; login: string } | null;

type PullRequestNode = Omit<
  PullRequest,
  "author" | "cursorAgentUrl" | "repository" | "checkState" | "requestedReviewers" | "humanThreadCount" | "botThreadCount"
> & {
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  commits: { nodes: { commit: { statusCheckRollup: { state: PullRequest["checkState"] } | null } }[] };
  reviewRequests: { nodes: { requestedReviewer: { login: string } | { name: string } | null }[] };
  latestReviews: { nodes: { state: string; author: Author }[] };
  reviewThreads: { nodes: { isResolved: boolean; comments: { nodes: { author: Author }[] } }[] };
};

type QueryData = {
  viewer: { login: string; pullRequests: { nodes: PullRequestNode[] } };
  search: { nodes: PullRequestNode[] };
};

function reviewDecisionFromReviews(reviews: PullRequestNode["latestReviews"]["nodes"]): PullRequest["reviewDecision"] {
  const humanStates = reviews.filter((review) => review.author?.__typename === "User").map((review) => review.state);
  if (humanStates.includes("CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  return humanStates.includes("APPROVED") ? "APPROVED" : null;
}

function cursorAgentUrl(body: string): string | null {
  const agentId = body.match(/(?:bcId=|cursor\.com\/agents\/)(bc-[\w-]+)/)?.[1];
  return agentId ? `https://cursor.com/background-agent?bcId=${agentId}` : null;
}

function toPullRequest(
  { author, repository, commits, reviewRequests, latestReviews, reviewThreads, ...pullRequest }: PullRequestNode,
  viewerLogin: string,
): PullRequest {
  const openThreadAuthors = reviewThreads.nodes
    .filter((thread) => !thread.isResolved)
    .map((thread) => thread.comments.nodes[0]?.author);
  return {
    ...pullRequest,
    author: author?.login ?? "ghost",
    cursorAgentUrl: cursorAgentUrl(pullRequest.body),
    repository: repository.nameWithOwner,
    checkState: commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    reviewDecision: pullRequest.reviewDecision ?? reviewDecisionFromReviews(latestReviews.nodes),
    requestedReviewers: reviewRequests.nodes.flatMap(({ requestedReviewer }) =>
      requestedReviewer ? ["login" in requestedReviewer ? requestedReviewer.login : requestedReviewer.name] : [],
    ),
    humanThreadCount: openThreadAuthors.filter(
      (threadAuthor) => threadAuthor?.__typename === "User" && threadAuthor.login !== viewerLogin,
    ).length,
    botThreadCount: openThreadAuthors.filter((threadAuthor) => threadAuthor?.__typename === "Bot").length,
  };
}

type PullRequestLists = { authored: PullRequest[]; reviewRequested: PullRequest[] };

const cacheDurationMs = 60_000;

let cache: { expiresAt: number; pullRequestLists: Promise<PullRequestLists> } | undefined;

async function queryPullRequests(): Promise<PullRequestLists> {
  const { stdout } = await execFileAsync("gh", ["api", "graphql", "-f", `query=${query}`], {
    maxBuffer: 50 * 1024 * 1024,
  });
  const { viewer, search }: QueryData = JSON.parse(stdout).data;
  return {
    authored: viewer.pullRequests.nodes.map((node) => toPullRequest(node, viewer.login)),
    reviewRequested: search.nodes.map((node) => toPullRequest(node, viewer.login)),
  };
}

export function fetchPullRequests(): Promise<PullRequestLists> {
  if (cache && cache.expiresAt > Date.now()) return cache.pullRequestLists;
  const pullRequestLists = queryPullRequests();
  cache = { expiresAt: Date.now() + cacheDurationMs, pullRequestLists };
  pullRequestLists.catch(() => {
    if (cache?.pullRequestLists === pullRequestLists) cache = undefined;
  });
  return pullRequestLists;
}
