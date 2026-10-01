import { readFile } from "node:fs/promises";
import { plural } from "./format.ts";
import { stackName } from "./stacks.ts";
import { pullRequestStatus, type Status } from "./status.ts";
import type { PullRequest, Stack, Subject } from "./types.ts";

type Badge = [label: string, tone: "good" | "bad" | "waiting" | "muted"];

const [styles, themeScript, favicon] = await Promise.all(
  ["./page.css", "./theme.js", "./favicon.svg"].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

const tallyLabels: Record<Status["kind"], string> = {
  onYou: "on you",
  waitingOnReviewer: "waiting",
  waitingOnCi: "waiting",
  readyToMerge: "ready to merge",
};

const tallyOrder = [...new Set(Object.values(tallyLabels))];

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

const renderBadge = ([label, tone]: Badge) => `<span class="badge ${tone}">${escapeHtml(label)}</span>`;

function statusBadge(status: Status): Badge {
  switch (status.kind) {
    case "onYou":
      return [`On you: ${status.reasons.join(", ")}`, "bad"];
    case "waitingOnReviewer":
      return [`Waiting on ${status.reviewers.map((reviewer) => `@${reviewer}`).join(", ")}`, "waiting"];
    case "waitingOnCi":
      return ["Waiting on CI", "waiting"];
    case "readyToMerge":
      return ["Ready to merge", "good"];
    default: {
      const unhandled: never = status;
      throw new Error(`Unhandled status: ${JSON.stringify(unhandled)}`);
    }
  }
}

function renderCounts(pullRequests: PullRequest[]): string {
  const groups = Map.groupBy(pullRequests, (pullRequest) => tallyLabels[pullRequestStatus(pullRequest).kind]);
  const tallies = tallyOrder.flatMap((label) => {
    const group = groups.get(label);
    return group ? [`${group.length} ${label}`] : [];
  });
  return `<span class="count">${[plural(pullRequests.length, "PR"), ...tallies].join(" · ")}</span>`;
}

type Cells = [link: string, threads: string, status: string];

function renderPullRequest(pullRequest: PullRequest, cells: Cells): string {
  const title = escapeHtml(pullRequest.title);
  return `<li><a href="${pullRequest.url}" target="_blank" rel="noopener">#${pullRequest.number}</a><span class="title" title="${title}">${title}</span>${cells.map((cell) => `<span class="cell">${cell}</span>`).join("")}</li>`;
}

const renderLinkBadge = (url: string, label: string) =>
  `<a class="badge muted" href="${url}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;

function renderAuthoredPullRequest(pullRequest: PullRequest): string {
  const chatLink = pullRequest.cursorAgentUrl ? renderLinkBadge(pullRequest.cursorAgentUrl, "Open in Cursor") : "";
  const botThreads =
    pullRequest.botThreadCount > 0 ? renderBadge([plural(pullRequest.botThreadCount, "bot thread"), "muted"]) : "";
  return renderPullRequest(pullRequest, [chatLink, botThreads, renderBadge(statusBadge(pullRequestStatus(pullRequest)))]);
}

const renderReviewPullRequest = (pullRequest: PullRequest) =>
  renderPullRequest(pullRequest, [
    renderLinkBadge(pullRequest.url.replace("https://github.com/", "https://linear.review/"), "Review in Linear"),
    "",
    renderBadge([`@${pullRequest.author}`, "muted"]),
  ]);

const renderPullRequestCount = (pullRequests: PullRequest[]) =>
  `<span class="count">${plural(pullRequests.length, "PR")}</span>`;

function renderStack(
  stack: Stack,
  renderRow: (pullRequest: PullRequest) => string,
  renderStackCounts: (pullRequests: PullRequest[]) => string,
): string {
  const items = `<ol>${stack.map(renderRow).join("")}</ol>`;
  if (stack.length === 1) return items;
  return `<details class="stack" open><summary>${escapeHtml(stackName(stack))}${renderStackCounts(stack)}</summary>${items}</details>`;
}

const renderSection = (title: string, counts: string, stacks: string[]) =>
  `<details class="subject" open><summary><h2>${escapeHtml(title)}</h2>${counts}</summary>${stacks.join("")}</details>`;

function renderSubject(subject: Subject): string {
  const stacks = subject.stacks.toSorted((first, second) => second.length - first.length);
  return renderSection(
    subject.name,
    renderCounts(stacks.flat()),
    stacks.map((stack) => renderStack(stack, renderAuthoredPullRequest, renderCounts)),
  );
}

function renderReviewSection(stacks: Stack[]): string {
  if (stacks.length === 0) return "";
  return renderSection(
    "Waiting on your review",
    renderPullRequestCount(stacks.flat()),
    stacks.map((stack) => renderStack(stack, renderReviewPullRequest, renderPullRequestCount)),
  );
}

const renderDocument = (content: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>My PRs</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${styles}</style><script>${themeScript}</script></head><body><main><header><h1>My PRs</h1><button class="theme-toggle" type="button" onclick="toggleTheme()">Toggle theme</button></header>${content}</main></body></html>`;

export function renderPage(subjects: Subject[], reviewStacks: Stack[], notice: string | undefined): string {
  const pullRequests = subjects.flatMap((subject) => subject.stacks.flat());
  return renderDocument(
    `${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ""}<p>${renderCounts(pullRequests)}</p>${renderReviewSection(reviewStacks)}${subjects.map(renderSubject).join("")}`,
  );
}

export function renderError(message: string): string {
  return renderDocument(`<p class="notice">${escapeHtml(message)}</p>`);
}
