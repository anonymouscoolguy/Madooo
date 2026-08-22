import { useId, useRef, useState, useTransition } from 'react'

import { sendSuggestion } from '@/lib/actions'
import { SUGGESTION_MAX_LENGTH, type SuggestionResult } from '@/lib/suggestions'
import { Icon } from './icon'

/**
 * The suggestion box: a labelled button in the top bar, and the dialog it opens.
 *
 * **No `'use client'` here.** `top-bar.tsx` already carries the directive, and a
 * module imported by a client component joins the client graph on its own — the
 * directive marks an *entry point* to the boundary, not every file on the far
 * side of it. `search-field.tsx` and `icon.tsx` have the same shape.
 *
 * **This is the only labelled control in the bar, and that is deliberate.** The
 * GitHub mark and the theme toggle are bare glyphs because they are chrome a
 * reader already knows how to find. This one has a job neither of those has: it
 * has to be *noticed* by someone who was not looking for it, because a
 * suggestion box nobody sees collects nothing. The label is the whole of that —
 * it is the only run of words in the bar, which is loud enough in a strip that
 * is otherwise four glyphs.
 *
 * **An outline was tried here and taken back out.** It read as a box inside a
 * box: `foundations.md` opens with "the border is the primary separator", so in
 * this system a border marks off a region rather than dressing a control, and a
 * bordered button inside a bordered strip competes with the bar's own bottom
 * edge. If this ever needs more presence than the label gives it, the in-system
 * move is a resting `--surface-alt` fill hovering to `--surface-sunken` — one
 * step along the ramp, which foundations already sanctions — and not an outline.
 *
 * **The label stays at every width**, including the phone, where it sits beside
 * the menu button. It was hidden below `md` first, on the assumption that five
 * words would not fit next to a menu button at 320px; they do, and the bar reads
 * better for it. That is why the button is `whitespace-nowrap` — the failure
 * mode worth designing against is the label wrapping to two lines inside a 56px
 * rail, not the label being absent.
 *
 * A knowing departure from the bar's own pattern rather than an oversight.
 */
export function SuggestionBox() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        /*
          No `aria-label`. The label is visible at every width, so the button's
          text *is* its accessible name and a second copy in an attribute would
          only be a thing to keep in step. `<Icon>` is `aria-hidden` as always,
          which is what stops the glyph's ligature text being read out beside it.

          If the label is ever hidden again at a breakpoint, the name has to come
          back as an `aria-label` — a control whose only content is a glyph has
          no accessible name at all.
        */
        className="t-hover flex h-(--control-h-lg) cursor-pointer items-center gap-2 rounded-md px-3 text-label whitespace-nowrap text-muted hover:bg-surface-alt hover:text-text focus-visible:focus-ring"
      >
        {/* 18px — foundations' size for a glyph inside a button, rather than the
            22px the two icon-only controls beside it take. */}
        <Icon name="inbox" size="md" />
        Suggest a feature
      </button>

      {/* Mounted only while open, which is what makes the draft disposable —
          the same reasoning as the note dialog, and what makes the entrance in
          `globals.css` need `@starting-style`. */}
      {open ? <SuggestionDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/**
 * The dialog.
 *
 * A native `<dialog>` opened with `showModal()`, following every rule the note
 * dialog established — the platform gives the focus trap, Escape, the inert
 * background and the top layer, and the top layer is the one that earns it,
 * because `<main>` is `position: relative` and would otherwise be the containing
 * block for anything fixed inside it.
 *
 * It has one thing the note dialog does not: an outcome. Saving a note is
 * instant and its result is visible on the row underneath, so there is nothing
 * to report. A suggestion goes somewhere the reader cannot see, so the dialog
 * has to say it arrived — which is what `sent` below is for.
 */
function SuggestionDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const hintId = useId()

  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function close() {
    // Never unmount straight from a handler: `close()` is what returns focus to
    // the button that opened this and what fires `onClose`, so Escape and every
    // button here leave through one path.
    dialog.current?.close()
  }

  function send() {
    setError(null)

    startTransition(async () => {
      let result: SuggestionResult
      try {
        result = await sendSuggestion(draft)
      } catch {
        // The action itself only throws if the session has gone or the database
        // is unreachable. Either way the draft is still on screen and still
        // sendable, which is the thing that must not be lost.
        setError('That did not send. Try again in a moment.')
        return
      }

      if (result.ok) {
        setSent(true)
        return
      }

      // A refusal keeps the draft. Blanking the box on a rate limit would throw
      // away the thing the reader is being asked to send later.
      setError(
        result.reason === 'rate-limited'
          ? 'That is a few in a short time — try again in an hour.'
          : 'A suggestion needs some words in it.',
      )
    })
  }

  const empty = draft.trim().length === 0

  return (
    <dialog
      ref={(element) => {
        /*
          A callback ref rather than an effect: it runs once the element is in
          the DOM and before paint, which is when `showModal()` has to be called
          — a `<dialog>` is inert markup until it is, and the attribute form
          (`open`) gives a non-modal dialog with no backdrop.

          React attaches a child's ref before its parent's, so the textarea is
          already known here. `showModal()` focuses the first focusable
          descendant, which is the close button; this puts focus where the
          typing goes instead.
        */
        dialog.current = element
        element?.showModal()
        field.current?.focus()
      }}
      onClose={onClose}
      // Dismiss on a press on the backdrop, on mouse *down* rather than click:
      // a click's target after a drag is the nearest common ancestor, so
      // selecting text in the textarea and releasing outside it would count as
      // a click on the dialog and throw the draft away.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      aria-labelledby={titleId}
      // No padding of its own — the sections carry their own, and the backdrop
      // test above only holds while there is no dialog surface to click on.
      // `m-auto` is not decoration: Tailwind's preflight zeroes every margin,
      // including the `margin: auto` the browser uses to centre a modal.
      className="dialog m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-md border border-border bg-surface p-0 text-text shadow-3"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={titleId} className="truncate text-heading">
          {sent ? 'Thank you' : 'Suggest a feature'}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="t-hover flex size-(--control-h) shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-alt hover:text-text focus-visible:focus-ring"
        >
          <Icon name="close" size="md" />
        </button>
      </div>

      {sent ? (
        /*
          The confirmation replaces the form rather than appearing beside it, and
          it is not a toast: the app has no toast primitive and this slice does
          not introduce one for a message that has a dialog to live in already.
          `role="status"` announces it without moving focus, which matters
          because focus is still in the textarea that has just gone away —
          the close button below takes it.
        */
        <div className="px-5 py-4">
          <p role="status" className="text-body text-muted">
            That has been sent. Thank you for helping shape what gets built next.
          </p>
        </div>
      ) : (
        <div className="px-5 py-4">
          <textarea
            ref={field}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            maxLength={SUGGESTION_MAX_LENGTH}
            aria-describedby={hintId}
            placeholder="What would you like to see, or see changed?"
            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-body text-text placeholder:text-faint focus:focus-field"
          />
          <p
            id={hintId}
            // Foundations' error state: the hint line is replaced by the message
            // in `--flop`, rather than the message being added underneath it.
            className={`mt-2 text-caption ${error === null ? 'text-muted' : 'text-flop'}`}
          >
            {error ?? 'Read by the person who builds this. There is no reply.'}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        {sent ? (
          <button
            type="button"
            onClick={close}
            autoFocus
            className="t-hover flex h-(--control-h-lg) cursor-pointer items-center rounded-md bg-surface-inverse px-5 text-label text-inverse hover:bg-surface-inverse-hover active:translate-y-px focus-visible:focus-ring"
          >
            Close
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={close}
              className="t-hover flex h-(--control-h-lg) cursor-pointer items-center rounded-md border border-border px-5 text-label text-text hover:border-border-strong hover:bg-surface-alt focus-visible:focus-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              // An empty box is not sendable, and neither is a second click
              // while the first is in flight. Foundations' disabled state is
              // opacity and a cursor, and nothing else.
              disabled={empty || pending}
              className="t-hover flex h-(--control-h-lg) cursor-pointer items-center rounded-md bg-surface-inverse px-5 text-label text-inverse hover:bg-surface-inverse-hover active:translate-y-px focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}
