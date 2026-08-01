---
name: slice
description: Run one vertical build slice end to end. `/slice start` branches and implements a plan that has already been agreed in plan mode; `/slice finish` updates the roadmap, self-reviews the diff and opens the PR. Use when working through a step in docs/roadmap.md.
---

# Slice

One vertical feature, from an agreed plan to a merged PR. Two phases, split by a
hard stop for browser verification that only the author can do.

Read the argument to decide which phase to run:

- `start` → [Phase: start](#phase-start)
- `finish` → [Phase: finish](#phase-finish)
- anything else, or no argument → say which phases exist and stop.

Both phases assume [`docs/roadmap.md`](../../../docs/roadmap.md) has been read
this session. If it has not, read it first.

---

## Phase: start

### Preconditions

Check all of these before touching anything. If any fails, stop and say why.

1. **A plan has been agreed in this conversation**, in plan mode. This phase
   executes a plan; it does not invent one. If there is no agreed plan, stop and
   propose entering plan mode instead.
2. Working tree is clean.
3. On `main`, and `main` is up to date with `origin/main`.

### Steps

**1. Branch first, before any file changes.**

```
git switch -c slice/<short-kebab-summary>
```

Retrofitting a branch after committing to `main` is the failure this ordering
exists to prevent.

**2. Write tests where they earn their place — not "if applicable".**

Test:

- Pure functions with a real payload as input. The sync mapper and the `now()`
  helper are the cases that exist so far.

Do not test:

- Prisma, Next's rendering, Clerk, or anything else third-party.
- Schema migrations and wiring, which have no meaningful assertion surface.

**Fixtures are read from the captured payloads in `scratch/` at test runtime.**
Never JSON typed from memory, and never JSON pasted into the test file. Assert
against values pulled out of the real file. The reason is specific: if the same
understanding writes both the mapper and its fixture, they agree with each other
and are both wrong, and the test proves nothing. The captured response is ground
truth; recollection is not.

**3. Implement.**

Before writing any Next-specific code, read the relevant guide in
`node_modules/next/dist/docs/`. This Next version has breaking changes against
training data — file conventions, APIs and directory structure may all differ.
Guessing here produces code that looks right and does not run.

Hold the non-negotiables from `AGENTS.md` while writing:

- `SEASON` comes from the environment. No year literal, anywhere.
- No API-Football call on page load. Only the sync job talks to the provider.
- Only the sync job sees provider JSON shape. One translation boundary.
- `now()` comes from the injectable helper.
- Every API-Football response has its `errors` field checked — refusals arrive
  inside HTTP 200 bodies.

**4. Run the gate.** All of these, not a subset:

```
npx tsc --noEmit
npm run lint
npm test            # if tests exist
npm run build       # if routes or rendering were touched
```

`tsc --noEmit` is the highest-value feedback loop in this stack for an author
learning TypeScript. Do not skip it because the build passed.

**5. Failure rule.**

Two failed attempts on the same failure → stop and report it. Do not attempt a
third fix.

**Never weaken an assertion, loosen a type, or add a cast to make something go
green.** A failing test is sometimes correctly reporting that the agreed plan is
wrong. If that is the reading, say so plainly and stop — that is a decision for
the author, not a thing to code around.

**6. Commit at every working state.**

Each commit must run. Commit messages carry **no** `Co-Authored-By` trailer and
no AI attribution of any kind.

**7. Stop.**

Do not push. Do not open a PR. Do not run `/slice finish`.

Print exactly what the author should check in the browser: the URL, and what
should be on screen if the slice worked. Then wait.

---

## Phase: finish

### Preconditions

1. On a `slice/*` branch.
2. **The author has confirmed browser verification passed.** If they have not
   said so, ask — do not infer it from the gate passing, and do not treat an
   unrelated message as confirmation.

### Steps

**1. Update `docs/roadmap.md` as a commit on this branch.**

It goes in the PR, not after the merge. A roadmap commit landing on `main`
afterwards defeats the branch flow.

Update all of these that moved:

- **Current state** — what now exists that did not before.
- The **Build order** checkbox for this step.
- **Next action** — rewritten for the next slice, including anything it is
  blocked on.
- **Open decisions** — move anything this slice settled out of the list, and add
  anything it opened.
- **Last updated** date.

**2. Self-review the whole diff.**

```
git diff main...HEAD
```

Read it as a reviewer, not as its author. Specifically check for:

- Secrets or connection strings outside `.env.local`.
- A hardcoded season year.
- Any API-Football call reachable from a page render.
- An unchecked `errors` field on a provider response.
- Direct `Date.now()` / `new Date()` instead of the injectable helper.
- Provider JSON shape leaking past the sync boundary.

Fix trivial findings. Report substantive ones rather than silently rewriting the
agreed plan.

**3. Push and open the PR.**

```
git push -u origin HEAD
gh pr create --title "<slice summary>" --body "<see below>"
```

Write the body rather than using `--fill`: it should say what the slice does,
how it was verified in the browser, and anything deliberately left out. None of
that is recoverable from the commit messages.

**4. Explain what is new.**

In chat, walk through the TypeScript- and Next-specific concepts that appear in
this diff for the first time — two or three sentences each. Assume Python
fluency; explain only what is genuinely different, and prefer explaining *why* a
convention exists over naming it. Do not explain general programming logic.

This is not optional garnish. Learning the ecosystem is half the point of the
project, and this is the moment the code is still fresh.

**5. Stop and hand back.**

A PR on a single-author repo is a reading device, not a gate. It only works if
the author reads the diff before merging, so do not merge on their behalf.

### After merge

Only when the author says the PR is merged:

```
gh pr merge --squash --delete-branch
git switch main
git pull
```

Squash-merge deliberately: the branch keeps the every-working-state commits,
`main` keeps one readable commit per slice.
