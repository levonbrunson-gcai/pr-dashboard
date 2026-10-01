import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fetchPullRequests } from "./github.ts";
import { fetchProjectNames } from "./linear.ts";
import { renderError, renderPage } from "./render.ts";
import { buildStacks } from "./stacks.ts";
import { groupBySubject, stackIssueIdentifiers } from "./subjects.ts";
import type { Config } from "./types.ts";

const port = Number(process.env.PORT ?? 4321);

async function buildDashboard(): Promise<string> {
  const config: Config = JSON.parse(await readFile(new URL("../config.json", import.meta.url), "utf8"));
  const { authored, reviewRequested } = await fetchPullRequests();
  const stacks = buildStacks(authored);
  const identifiers = [...new Set(stacks.flatMap((stack) => stackIssueIdentifiers(stack, config.linearTeamKeys)))];
  const projectByIssue = await fetchProjectNames(identifiers);
  const notice = process.env.LINEAR_API_KEY
    ? undefined
    : "LINEAR_API_KEY is not set, so only the overrides in config.json assign subjects.";
  return renderPage(groupBySubject(stacks, config, projectByIssue), buildStacks(reviewRequested), notice);
}

createServer(async (request, response) => {
  if (request.url !== "/") {
    response.writeHead(404).end();
    return;
  }
  const html = await buildDashboard().catch((error: Error) => renderError(error.message));
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
}).listen(port, "127.0.0.1", () => console.log(`PR dashboard on http://localhost:${port}`));
