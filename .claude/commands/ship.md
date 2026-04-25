---
description: Pre-commit checklist — build, summarize diff, draft a Conventional Commit message.
---

# /ship

Run the pre-commit gate before the user commits.

1. Run `npm run build` and report any TypeScript errors. **Stop if it fails** — do not propose a commit message.
2. Run `git status` and `git diff --stat` to summarize changed files.
3. Verify no `.env`, `dist/`, secrets, tokens, or `console.log` left behind in the diff.
4. Confirm the change is in scope (no unrelated reformatting).
5. Draft a Conventional Commit message (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`) with a concise subject (≤ 72 chars) and a short body listing the user-visible change.

Do **not** run `git commit` or `git push` — present the message and let the user run it.
