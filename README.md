# pr-dashboard

A local dashboard for your open GitHub pull requests, grouped by subject and by stack.

GitHub lists PRs flat. This groups them:

- **By subject:** each stack is filed under the Linear project most of its PRs reference (issue IDs in branch names, titles, or descriptions). Manual overrides cover the gaps.
- **By stack:** PRs that target each other's branches are nested from bottom to top.

Each PR shows whose move it is:

- **On you:** draft, CI failing, changes requested, an unresolved review thread from a person, or no reviewer requested yet.
- **Waiting on @reviewer** or **Waiting on CI.**
- **Ready to merge:** approved and CI not running.

It also shows unresolved bot review threads, an "Open in Cursor" link when the PR description links a Cursor agent, and a "Waiting on your review" section with "Review in Linear" links.

## Requirements

- Node.js 22.18 or later. It runs the TypeScript directly, with no build step and no dependencies.
- [GitHub CLI](https://cli.github.com/), logged in with `gh auth login`.
- Optional: a [Linear personal API key](https://linear.app/settings/account/security), for grouping by Linear project.

## Setup

```sh
git clone https://github.com/levonbrunson-gcai/pr-dashboard.git
cd pr-dashboard
cp config.example.json config.json
cp .env.example .env
npm start
```

Add your Linear key to `.env`, then open http://localhost:4321. Set `PORT` in `.env` to use a different port. The server reloads when files in `src/` change.

## Configuration

`config.json` is read on every page load, so edits apply on refresh.

- `linearTeamKeys`: the Linear team keys to look for. `["ENG"]` matches `ENG-123`.
- `overrides`: branch prefix to subject name. A stack with a branch that starts with the prefix goes to that subject, ahead of Linear. Stacks with no match go to "Unsorted".

## Notes

- GitHub requests go through your `gh` login, so no token is stored here. The dashboard only reads.
- GitHub gives each user 5,000 GraphQL points per hour, shared across every tool that uses your account. A fetch costs about 40 points, and results are cached for 60 seconds.
- The server only listens on 127.0.0.1.
