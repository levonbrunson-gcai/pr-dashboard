const query = `query ($keys: [String!], $numbers: [Float!]) {
  issues(first: 250, filter: { team: { key: { in: $keys } }, number: { in: $numbers } }) {
    nodes { identifier project { name } }
  }
}`;

type LinearResponse = {
  data: { issues: { nodes: { identifier: string; project: { name: string } | null }[] } };
};

export function findIssueIdentifiers(text: string, linearTeamKeys: string[]): string[] {
  const pattern = new RegExp(`\\b(?:${linearTeamKeys.join("|")})-\\d+\\b`, "gi");
  return [...new Set(text.match(pattern)?.map((identifier) => identifier.toUpperCase()))];
}

export async function fetchProjectNames(identifiers: string[]): Promise<Map<string, string>> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey || identifiers.length === 0) return new Map();
  const keys = new Set(identifiers.map((identifier) => identifier.split("-")[0]));
  const numbers = identifiers.map((identifier) => Number(identifier.split("-")[1]));
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables: { keys: [...keys], numbers } }),
  });
  if (!response.ok) throw new Error(`Linear returned ${response.status}: ${await response.text()}`);
  const { data }: LinearResponse = await response.json();
  return new Map(
    data.issues.nodes.flatMap((issue) => (issue.project ? [[issue.identifier, issue.project.name] as const] : [])),
  );
}
