import Link from 'next/link'
import { Icon } from './icon'

type Props = {
  /**
   * `ReactNode` rather than `string` so a title can carry markup — the match
   * page puts its scoreline in a monospaced span, because foundations' rule is
   * that a number you can add up is monospaced, and a scoreline is the most
   * counted number on that page.
   */
  title: React.ReactNode
  /** A way back up, for the screens reached from another screen rather than from the sidebar. */
  back?: { href: string; label: string }
  /**
   * An identity mark set beside the title and its subtitle, rather than above
   * them — a player's shirt tile is the only one so far. It lives here rather
   * than being drawn by the page because the title and the subtitle have to sit
   * in a block next to it, and a page that assembled that itself would be a
   * second opinion about the header's spacing and type.
   */
  mark?: React.ReactNode
  children?: React.ReactNode
}

/**
 * The title block every screen opens with. One component so the destinations
 * cannot drift apart on spacing or type.
 */
export function PageHeader({ title, back, mark, children }: Props) {
  return (
    <header className="mb-8">
      {back ? (
        // Muted going to full ink on hover, which is foundations' rule for muted
        // text, and no underline in either state — the base stylesheet gives
        // every <a> the link colour and a hover underline, which is right for
        // prose and wrong for chrome.
        <Link
          href={back.href}
          className="t-hover mb-3 -ml-1 inline-flex items-center gap-1 rounded-md text-label text-muted no-underline hover:text-text hover:no-underline focus-visible:focus-ring"
        >
          <Icon name="chevron_left" size="md" />
          {back.label}
        </Link>
      ) : null}
      {/*
        The row is unconditional, and with no mark it lays out exactly as the
        block it replaced: one flex child taking `flex-1` is the full width, and
        `items-center` has nothing to centre against. `min-w-0` so a long title
        can wrap rather than forcing the row wider than its container.
      */}
      <div className="flex items-center gap-4">
        {mark}
        <div className="min-w-0 flex-1">
          <h1 className="text-title">{title}</h1>
          {children ? <p className="mt-2 text-body text-muted">{children}</p> : null}
        </div>
      </div>
    </header>
  )
}
