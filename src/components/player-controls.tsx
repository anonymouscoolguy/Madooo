'use client'

import { startTransition, useId, useOptimistic, useRef, useState } from 'react'

import { Icon } from './icon'
import { setNote } from '@/lib/actions'
import { NOTE_MAX_LENGTH } from '@/lib/verdicts'
import type { ReactNode } from 'react'

/**
 * The write controls on a squad row: the three verdict chips, the note button,
 * and the note itself once there is one.
 *
 * **Why this owns the chips rather than sitting beside them.** The note button
 * and the note text are in two different cells of the row's grid — the button
 * beside the chips, the note on its own line underneath — but they share one
 * piece of optimistic state, and state has to have a single owner above both.
 * This component is that owner, and returning a **fragment** is what lets it
 * place two children into the parent's grid: a fragment produces no DOM of its
 * own, so both remain direct children of the `<li>` and the grid sees them.
 *
 * The chips arrive as `children` rather than through an import — the same
 * composition the shell uses to pass `<Sidebar />` into `AppFrame`. It keeps
 * `VerdictControls` free of any knowledge of notes, and keeps the row's markup
 * in `squad-panel.tsx` reading left to right the way it draws.
 */

type Props = {
  matchSquadId: number
  /** For the button's accessible name and the dialog's title. */
  playerName: string
  note: string | null
  /** The verdict chips. */
  children: ReactNode
}

export function PlayerControls({ matchSquadId, playerName, note, children }: Props) {
  /*
    The same hook as the chips, for the same reason: it holds what was just
    typed until `refresh()` brings the server's own answer back, and then drops
    it. No `useState` copy of the note is kept, so there is nothing to fall out
    of step with the database.
  */
  const [shown, setShown] = useOptimistic(note)
  const [open, setOpen] = useState(false)

  function save(draft: string) {
    // Trimmed here as well as in the action, and neither is redundant: the
    // action cannot trust a value that crossed the network, and this side needs
    // the same value the server will store or the optimistic text would differ
    // from what appears a moment later.
    const text = draft.trim()

    startTransition(async () => {
      setShown(text === '' ? null : text)
      await setNote(matchSquadId, text)
    })
  }

  const empty = shown === null

  return (
    <>
      {/*
        `col-end-[-1]` is the last grid line whichever layout is in force, so one
        pair of classes covers both: below `md` the controls span columns 2–3 on
        a second row, and at `md` they are the fourth column of the first.
      */}
      <div className="col-start-2 col-end-[-1] flex gap-1 justify-self-start md:col-start-4 md:justify-self-end">
        {children}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${empty ? 'Add' : 'Edit'} note on ${playerName}`}
          className={[
            // The same box as a chip, and deliberately without its border: the
            // design draws this one borderless, which is what keeps a row of
            // four controls from reading as four equal choices.
            'flex size-(--control-h-lg) items-center justify-center rounded-md md:size-(--control-h)',
            'active:translate-y-px focus-visible:focus-ring',
            empty
              ? 't-hover text-muted hover:bg-surface-alt hover:text-text'
              : // One step further down the surface ramp than the resting
                // hover, and no hover of its own — the same reasoning as a
                // selected chip, which has nothing below its tint to darken to.
                // The glyph does not fill: `FILL 1` means "on" for the states
                // foundations lists, and a note is not one of them.
                'bg-surface-sunken text-text',
          ].join(' ')}
        >
          <Icon name="edit_note" size="md" />
        </button>
      </div>

      {empty ? null : (
        // Indented to the name above it and marked with a rule, as the design
        // draws it. `whitespace-pre-line` keeps the line breaks that were typed
        // — the textarea allows them, so throwing them away here would silently
        // rewrite what the reader wrote.
        <p className="col-start-2 col-end-[-1] border-l-2 border-border pl-3 text-body whitespace-pre-line text-muted">
          {shown}
        </p>
      )}

      {open ? (
        <NoteDialog
          playerName={playerName}
          note={shown}
          onSave={save}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

type DialogProps = {
  playerName: string
  note: string | null
  onSave: (draft: string) => void
  onClose: () => void
}

/**
 * The note dialog.
 *
 * A native `<dialog>` opened with `showModal()`, not a hand-rolled overlay. The
 * platform gives the focus trap, Escape, the inert background and the top layer
 * for free — and the top layer is the one that matters most here, because
 * `<main>` is `position: relative` and would otherwise be the containing block
 * for anything fixed inside it.
 *
 * It is mounted only while it is open, which is what makes the draft
 * disposable: Cancel discards by unmounting, and there is no stale text to
 * clear. It is also what makes the entrance animation in `globals.css` need
 * `@starting-style`.
 */
function NoteDialog({ playerName, note, onSave, onClose }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const [draft, setDraft] = useState(note ?? '')

  function close() {
    // Never unmount straight from a handler. `close()` is what returns focus to
    // the button that opened this, and it is what fires `onClose` below — so
    // Escape and every button here leave through one path.
    dialog.current?.close()
  }

  return (
    <dialog
      ref={(element) => {
        /*
          A callback ref, rather than an effect: it runs once the element is in
          the DOM and before paint, which is when `showModal()` has to be
          called — a `<dialog>` is inert markup until it is, and the attribute
          form (`open`) gives a non-modal dialog with no backdrop.

          React attaches a child's ref before its parent's, so the textarea is
          already known here. Focusing it after `showModal()` is deliberate:
          `showModal()` moves focus to the first focusable descendant, which is
          the close button, and this puts it where the typing goes. The caret
          goes to the end, so editing an existing note appends rather than
          prepends.
        */
        dialog.current = element
        element?.showModal()

        const textarea = field.current
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(textarea.value.length, textarea.value.length)
        }
      }}
      onClose={onClose}
      // Dismiss on a press on the backdrop. On mouse *down* rather than click,
      // because a click's target after a drag is the nearest common ancestor —
      // so selecting text in the textarea and releasing outside it would count
      // as a click on the dialog and throw the draft away.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      aria-labelledby={titleId}
      // No padding of its own: the three sections carry their own, and the
      // backdrop test above only holds while there is no dialog surface to
      // click on. `m-auto` is not decoration — Tailwind's preflight zeroes every
      // margin, including the `margin: auto` the browser uses to centre a modal.
      className="dialog m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-md border border-border bg-surface p-0 text-text shadow-3"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={titleId} className="truncate text-heading">
          Note on {playerName}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="t-hover flex size-(--control-h) shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text focus-visible:focus-ring"
        >
          <Icon name="close" size="md" />
        </button>
      </div>

      <div className="px-5 py-4">
        <textarea
          ref={field}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Any notes on his performance?"
          className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-body text-text placeholder:text-faint focus:focus-field"
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={close}
          className="t-hover flex h-(--control-h-lg) cursor-pointer items-center rounded-md border border-border px-5 text-label text-text hover:border-border-strong hover:bg-surface-alt focus-visible:focus-ring"
        >
          Cancel
        </button>
        {/*
          Saving an empty box is how a note is deleted — there is no delete
          button, and the design draws none. No hover colour on this one, which
          is the gap the roadmap records under 8.3: foundations' hover rule is
          "surfaces darken one step" and nothing sits below `--surface-inverse`.
        */}
        <button
          type="button"
          onClick={() => {
            onSave(draft)
            close()
          }}
          className="flex h-(--control-h-lg) cursor-pointer items-center rounded-md bg-surface-inverse px-5 text-label text-inverse active:translate-y-px focus-visible:focus-ring"
        >
          Save note
        </button>
      </div>
    </dialog>
  )
}
