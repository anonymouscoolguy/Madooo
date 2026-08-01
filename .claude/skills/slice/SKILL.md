---
name: slice
description: Run one vertical build slice end to end. `/slice start` branches, implements a plan already agreed in plan mode, self-reviews the diff and updates the roadmap; `/slice finish` pushes, squash-merges into main and deletes the branch. Use when working through a step in docs/roadmap.md.
---

# Slice

One vertical feature, from an agreed plan to a merged `main`. `start` does the
whole slice; `finish` only lands it, once the author has seen it work in the
browser. The split exists for that browser check, which only the author can do.

Read the argument to decide which phase to run:

- `start` → [Phase: start](#phase-start)
- `finish` → [Phase: finish](#phase-finish)
- anything else, or no argument → say which phases exist and stop.

`start` assumes [`docs/roadmap.md`](../../../docs/roadmap.md) has been read this
session. If it has not, read it first.

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

**7. Check the diff against the fixed criteria.**

```
git diff main...HEAD
```

This is a checklist, not a review. The same understanding that wrote the code is
reading it, so it cannot judge whether the design is right — it can only run
specific queries over the accumulated whole, including the debug line added
three fixes ago and the files you forgot you touched. Check for:

- Secrets or connection strings outside `.env.local`.
- A hardcoded season year.
- Any API-Football call reachable from a page render.
- An unchecked `errors` field on a provider response.
- Direct `Date.now()` / `new Date()` instead of the injectable helper.
- Provider JSON shape leaking past the sync boundary.

Fix trivial findings. Report substantive ones rather than silently rewriting the
agreed plan.

**8. Explain what is new.**

In chat, walk through the TypeScript- and Next-specific concepts that appear in
this diff for the first time — two or three sentences each. Assume Python
fluency; explain only what is genuinely different, and prefer explaining *why* a
convention exists over naming it. Do not explain general programming logic.

This is not optional garnish. Learning the ecosystem is half the point of the
project, and this is the moment the code is still fresh.

**9. Update `docs/roadmap.md`, as the last step of this phase.**

Last deliberately: the roadmap describes the slice as built, which is only known
once the diff has been read. It commits on this branch, so it lands with the
slice rather than as a stray commit on `main` afterwards.

Update all of these that moved:

- **Current state** — what now exists that did not before.
- The **Build order** checkbox for this step.
- **Remarks that might be important** — see below.
- **Open decisions** — move anything this slice settled out of the list, and add
  anything it opened.
- **Last updated** date.

**On "Remarks that might be important":** record what the next slice would want
to know and could not recover from the code — a gotcha hit along the way, a
shortcut taken deliberately, something left unmapped, a constraint discovered in
a payload. Facts and carry-overs, in other words.

**Do not plan the next slice here.** No task lists, no ordering, no "first do X
then Y". Planning happens in plan mode, with the author, at the start of the
next slice — a plan written now would be written blind and would quietly become
the plan by default.

**10. Stop.**

Do not push. Do not run `/slice finish` — that is the author's call, made once
they have seen the slice work in the browser.

Print exactly what the author should check in the browser: the URL, and what
should be on screen if the slice worked. Then wait.

**Expect questions before `finish`.** The author skims `git diff main...HEAD`
themselves and asks about what they find — this is the only independent read the
slice gets, and it is why `finish` is a separate command rather than the tail of
this one. Answer the questions; if one lands, fix it and commit on this branch.
Do not treat the questions as an approval signal or as a cue to run `finish`.

---

## Phase: finish

Push, merge, delete. Nothing else — the slice was finished in `start`.

### Preconditions

1. On a `slice/*` branch.
2. Working tree is clean. Anything uncommitted means `start` did not finish;
   say so and stop rather than sweeping it into the merge.

### Steps

**1. Push, merge, delete.**

```
git push -u origin HEAD                   # the working-state commits, preserved on the remote
git switch main
git pull
git merge --squash slice/<name>
git commit                                # one readable commit for the whole slice
git push
git branch -D slice/<name>
git push origin --delete slice/<name>
```

Squash deliberately: the branch keeps the every-working-state commits, `main`
keeps one readable commit per slice.

The squash commit message is the only lasting record of the slice, so write it
properly — what the slice does and anything deliberately left out. Neither is
recoverable from the individual commits. No `Co-Authored-By` trailer.

`branch -D`, not `-d`: a squash merge leaves no merge ancestry, so git does not
believe the branch is merged and `-d` refuses it. That refusal is not a warning
worth heeding here — the commits are on the remote branch either way.

**2. Stop and hand back.**

Report what landed on `main`. The slice is over; do not start the next one.
