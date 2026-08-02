import { PageHeader } from '@/components/page-header'

/**
 * A placeholder the sidebar can point at. The diary itself — judgements
 * reverse-chronological, dated, grouped by match — arrives in step 7.1.
 */
export default function Diary() {
  return (
    <>
      <PageHeader title="Diary">Everything you have written down, most recent first.</PageHeader>
      <p className="text-body text-muted">
        Nothing here yet — start by opening a fixture and rating the players.
      </p>
    </>
  )
}
