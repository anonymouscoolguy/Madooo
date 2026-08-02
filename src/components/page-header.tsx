/**
 * The title block every screen opens with. One component so the four
 * destinations cannot drift apart on spacing or type.
 */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-title">{title}</h1>
      {children ? <p className="mt-2 text-body text-muted">{children}</p> : null}
    </header>
  )
}
