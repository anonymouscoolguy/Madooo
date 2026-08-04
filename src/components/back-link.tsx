import Link from 'next/link'
import { Icon } from './icon'

/**
 * "← Back to fixtures", for a screen reached from another screen rather than
 * from the sidebar.
 *
 * It lived inside `PageHeader` until the match page grew a header that is a card
 * rather than a title block. That screen wants this link and nothing else of the
 * header it came from, and two copies of these classes would be two chances for
 * one link to drift apart from itself.
 *
 * Extracted rather than made a `PageHeader` variant: a variant would have to
 * suppress the title, the mark slot, the subtitle and the row holding them —
 * which is the whole component — and would leave `title` conditionally required.
 *
 * The `mb-3` travels with the component on purpose. 12px between the link and
 * whatever it sits above is a fixed relationship, not a decision per caller.
 *
 * Muted going to full ink on hover, which is foundations' rule for muted text,
 * and no underline in either state — the base stylesheet gives every `<a>` the
 * link colour and a hover underline, which is right for prose and wrong for
 * chrome.
 *
 * Note that [`back.ts`](../lib/back.ts) exports a `BackLink` *interface*
 * describing the same two fields. They are one idea seen from two sides — a
 * destination that has been computed, and the props that draw it — and no module
 * imports both.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="t-hover mb-3 -ml-1 inline-flex items-center gap-1 rounded-md text-label text-muted no-underline hover:text-text hover:no-underline focus-visible:focus-ring"
    >
      <Icon name="chevron_left" size="md" />
      {label}
    </Link>
  )
}
