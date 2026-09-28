# General instructions

1. For all major choices regarding the project, update the `METHODS.md`.
1. Read the `nobeldata.md` and `instructions.md`. After that, ask at most 10 questions to clarify the situation. If you still have questions, I will do an update of the documents and we will start over.
1. Select a system architecture fitting for the task.
1. There are some existing accounts for different services (resend, railway, one.com etc). I will provide authentication info when needed.
1. Plan the whole project, break down to tasks and update `TASKS.md`. Try to create non-blocking tasks.
1. For each task or set of related tasks, create a verification condition. Add that to the corresponding tasks/set of tasks in `TASKS.md`.
1. Security should be "regular", users log in with email, password and verification mail (resend account exists).

# Framework/tooling agent notes

The scaffolding tools for this project (`create-next-app`, `prisma init`) generate their own up-to-date guidance for working with their current, post-training-cutoff APIs. Load these before writing framework or Prisma code:
- `@AGENTS.md` — Next.js 16 API notes (regenerated automatically by `next dev`/`next build`; safe to keep committed).
- `.agents/skills/` — Prisma 7 skill references (schema/config/driver-adapter changes, CLI usage, client API). See `METHODS.md`'s "Implementation notes" section for what's already been learned from them.

