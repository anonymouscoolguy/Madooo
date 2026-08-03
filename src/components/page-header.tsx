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
  children?: React.ReactNode
}

/**
 * The title block every screen opens with. One component so the destinations
 * cannot drift apart on spacing or type.
 */
export function PageHeader({ title, back, children }: Props) {
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
      <h1 className="text-title">{title}</h1>
      {children ? <p className="mt-2 text-body text-muted">{children}</p> : null}
    </header>
  )
}
