import { BackLink } from './back-link'

type Props = {
  /**
   * `ReactNode` rather than `string` so a title can carry markup — a screen that
   * wants part of its title in another type role can say so without this
   * component knowing which part or why.
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
      {back ? <BackLink {...back} /> : null}
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
