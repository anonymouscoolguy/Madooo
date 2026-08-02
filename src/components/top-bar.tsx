/**
 * The top bar, and it is empty on purpose.
 *
 * The design puts a search field and a dark-mode toggle in here, but the search
 * belongs to step 8.2 and the toggle to 8.1 — and a search box that does nothing
 * is worse than no search box. What is left is still doing work: it is the fixed
 * boundary the content scrolls under, and it holds the frame at the height every
 * later slice will drop its controls into.
 */
export function TopBar() {
  return <header className="h-(--rail-w) border-b border-border bg-surface" />
}
