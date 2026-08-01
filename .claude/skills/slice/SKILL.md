---
name: slice
description: Run one vertical build slice end to end. `/slice start` branches, implements a plan already agreed in plan mode, self-reviews the diff and updates the roadmap; `/slice finish` squash-merges into main, pushes main and deletes the branch. Use when working through a step in docs/roadmap.md.
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

- Pure functions with a real payload as input. The sync mapper is the case that
  exists so far.

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

Read the relevant guide in `node_modules/next/dist/docs/` before writing any
Next-specific code — the rule at the top of `AGENTS.md`, applied here because
this is the moment it binds.

Hold the non-negotiables in `AGENTS.md` while writing. Step 7 reads the diff for
breaches of them, but that is a backstop, not the place they are meant to be
caught.

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
- **Long-term remarks** — see below. Most slices add nothing here.
- **Open decisions** — move anything this slice settled out of the list, and add
  anything it opened.
- **Last updated** date.

**On "Remarks that might be important":** record what *this* slice turned up
that the *next* one will want in front of it — a gotcha hit along the way, a
shortcut taken deliberately, something left unmapped, a constraint discovered in
a payload. Facts and carry-overs, in other words.

Whether it could be recovered from the code is not the test. Plenty of it could
be, given enough reading; the point of the remark is that the next slice does
not have to go looking. The test is only whether this slice's context makes the
next one's work go differently. If nothing does, write nothing — an empty
section is a true statement, and padding it buries the entries that matter.

**On "Long-term remarks":** a far higher bar, and a different one. An entry
qualifies only if all three hold:

1. It was **explicitly agreed with the author**. Not inferred, not assumed
   because it seemed sensible while implementing.
2. It **cannot be derived from the code**. If reading the repo would tell you,
   the repo is already the better record.
3. It **outlives the next slice**. It shapes work several steps away, or it
   constrains everything until something specific changes.

Each entry names its own exit: `<remark>, can be resolved when X is
implemented`. That clause is what makes the section prunable — an entry is
removed on the evidence of X existing, rather than on someone's judgement that
it feels stale. An entry nobody can write an exit clause for is not a long-term
remark; it is an open decision, and belongs in that section instead.

The two remark sections differ deliberately on point 2. A slice remark is a
convenience for the next slice, so being recoverable from the code does not
disqualify it. A long-term remark is asking for permanent space in a file every
fresh session reads, so it has to be something the code can never tell you.

**Most slices add nothing here.** Adding an entry is close to a decision in its
own right; if it was not discussed with the author, it does not go in.

**Do not plan the next slice here.** No task lists, no ordering, no "first do X
then Y". Planning happens in plan mode, with the author, at the start of the
next slice — a plan written now would be written blind and would quietly become
the plan by default.

The tell is grammatical: a remark states what *is* true, so it survives being
read a month later. A plan uses imperatives — "add X", "set up Y", "fetch Z" —
and a heading naming the next step is usually a task list about to happen. Two
things that are never remarks: restatements of the `AGENTS.md` non-negotiables,
which are already binding, and anything already recorded elsewhere in the
roadmap.

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

Merge, push, delete. Nothing else — the slice was finished in `start`.

### Preconditions

1. On a `slice/*` branch.
2. Working tree is clean. Anything uncommitted means `start` did not finish;
   say so and stop rather than sweeping it into the merge.

### Steps

**1. Merge, push, delete.**

```
git switch main
git pull --ff-only
git merge --squash slice/<name>
git commit                                # one readable commit for the whole slice
git push
git branch -D slice/<name>
```

The slice branch is never pushed. It exists so that work in progress can be
committed freely without `main` ever holding a broken state; once the squash
commit lands, it has no further job. Nothing else consumes it — there is no PR
in this flow — so pushing it would only be to delete it again.

`--ff-only` on the pull is deliberate. `main` should only ever move forward by
these squash commits, so if it cannot fast-forward, something has gone wrong and
the merge should stop rather than quietly manufacture a merge commit.

The squash commit message is the only lasting record of the slice, so write it
properly — what the slice does and anything deliberately left out. Neither is
recoverable from the individual commits. No `Co-Authored-By` trailer.

`branch -D`, not `-d`: a squash merge leaves no merge ancestry, so git does not
believe the branch is merged and `-d` refuses it. That refusal is not a warning
worth heeding here — the squash commit on `main` contains every change the
branch made. Only the intermediate commits go, and they are the part that was
never meant to last.

**2. Stop and hand back.**

Report what landed on `main`. The slice is over; do not start the next one.
