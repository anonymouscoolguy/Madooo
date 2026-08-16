/**
 * GitHub's mark, and the one glyph in the app that is not a Material Symbol.
 *
 * `foundations.md` fixes the icon set at Material Symbols Outlined and says that
 * anything without a glyph there becomes a word. This is the documented
 * exception to that rule, and it is narrow on purpose: the octocat is how a
 * repository link is recognised without being read, and "use a word" would give
 * back the labelled row that made this look like a fifth destination. The
 * exception covers this mark, wherever the repository is linked — the top bar
 * and the landing page's button, which are the two places. Some *other*
 * non-Symbol glyph is a new decision, not a precedent already set.
 *
 * It is inline SVG rather than a file in `public/` — unlike the flags, which are
 * `<img>` — because an `<img>` cannot inherit `currentColor`. The mark has to
 * take its colour from the control around it, in both themes and on hover, and
 * that is only possible if the path is in the document. It is why the same
 * component can sit muted in the top bar and inverted on a filled button
 * without either caller passing it a colour.
 *
 * Callers set the size, and it goes 2px under the Material Symbol beside it:
 * `size-5` against the top bar's 22px toggle, `size-4` against the button's
 * 18px. A solid silhouette carries more ink than a 2px outline at the same box.
 *
 * `aria-hidden`, like `<Icon>`: the mark stands alone here, so the name lives on
 * the anchor around it.
 *
 * The path is GitHub's official 16px mark, unaltered. Their brand guidelines
 * permit it for linking to a repository, which is the whole of what it does
 * here. Note that this is not the licence club crests have — hence
 * `Team.logo` still rendering nowhere.
 */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}
