---
description: Stages all changes, writes a conventional commit message, pushes to origin, and opens a PR with a summary.
allowed-tools: Bash, Read, Grep
---

You are helping the user commit, push, and open a pull request. Follow these steps exactly:

1. **Stage changes**
   Run `git status` to see what's changed.
   Run `git add -A` to stage all changes (or ask the user if they want to be selective).

2. **Write a commit message**
   Run `git diff --cached` to review what's staged.
   Write a conventional commit message:
   - Format: `<type>(<scope>): <short summary>`
   - Types: feat, fix, chore, refactor, docs, test, ci
   - Keep the subject line under 72 characters
   - Add a body if the change is non-trivial

3. **Commit**
   Run `git commit -m "<your message>"`

4. **Push**
   Run `git push origin HEAD`
   If the branch has no upstream, run `git push --set-upstream origin <branch-name>`

5. **Open a PR**
   Run `gh pr create --fill` to auto-fill title/body from the commit message.
   If $ARGUMENTS is provided, use it as the PR title instead.
   Add the `--draft` flag if the branch name starts with `wip/` or `draft/`.

6. **Report back**
   Share the PR URL with the user.

If any step fails, stop and explain what went wrong before continuing.