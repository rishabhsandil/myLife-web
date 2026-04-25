# AGENTS.md

This repo follows the [agents.md](https://agents.md/) convention for AI coding tools (Claude Code, Copilot, Cursor, Aider, etc.).

**The canonical guidance lives in [CLAUDE.md](./CLAUDE.md).** Read it first.

## TL;DR for any agent

- **Stack:** React 18 + TS + Vite (frontend), Vercel serverless + Neon Postgres (backend), JWT auth.
- **Build:** `npm run build` (this is the only quality gate — there is no test runner or linter).
- **Dev:** `npm run dev`.
- **Never** commit `.env`, `dist/`, or `node_modules/`.
- **Never** disable `tsc strict`, use `// @ts-ignore`, or add `any`.
- **Never** call `fetch` from a page — go through [src/utils/api.ts](src/utils/api.ts).
- **Never** interpolate user input into SQL — use the `sql` tagged template.
- **Always** run `npm run build` before reporting a task as complete.
- **Always** match existing patterns: `useModal` + `<Modal>`, `useList`, sibling `.css` files, theme variables.

## Scope rules

- Stay in scope. Don't reformat or "improve" unrelated code.
- Page files > 300 LOC should be split (see `pages/workout/` for the pattern).
- Refactor backlog is in [CLAUDE.md §6](./CLAUDE.md#6-known-smells--refactor-backlog) — don't expand those smells.

## Memory & skills (Claude Code)

Project-scoped Claude Code resources live under [.claude/](./.claude/):

- [.claude/settings.json](./.claude/settings.json) — shared permissions and config
- [.claude/commands/](./.claude/commands/) — slash commands (`/audit`, `/ship`)
- [.claude/agents/](./.claude/agents/) — subagent definitions
- [.claude/skills/](./.claude/skills/) — on-demand skills for project-specific workflows

Personal overrides go in `.claude/settings.local.json` (gitignored).
