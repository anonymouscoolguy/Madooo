import { PageHeader } from '@/components/page-header'

/**
 * A placeholder the sidebar can point at. The real index arrives in step 7.3,
 * linking into the player profiles built in 7.2.
 */
export default function Players() {
  return (
    <>
      <PageHeader title="Players">
        Every player you have judged, and what you said about them.
      </PageHeader>
      <p className="text-body text-muted">
        Nothing here yet — this arrives once there are judgements to read back.
      </p>
    </>
  )
}
