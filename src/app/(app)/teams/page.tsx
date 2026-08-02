import { PageHeader } from '@/components/page-header'

/**
 * A placeholder the sidebar can point at. The team index and profile arrive in
 * step 7.4.
 */
export default function Teams() {
  return (
    <>
      <PageHeader title="Teams">
        Each club, and your verdicts on the players who turned out for it.
      </PageHeader>
      <p className="text-body text-muted">
        Nothing here yet — this arrives once there are judgements to read back.
      </p>
    </>
  )
}
