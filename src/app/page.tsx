import { SignInButton, SignUpButton } from '@clerk/nextjs'

import { Badge, VERDICT_BADGE } from '@/components/badge'
import { Icon } from '@/components/icon'
import { LandingPreview } from '@/components/landing-preview'

/**
 * The landing page: what a signed-out visitor sees, and the only public screen
 * in the app.
 *
 * **It touches no database**, which is what lets it be prerendered at build time
 * — the one route in the project that is. Everything on it is a constant in this
 * file or in [`landing-preview.tsx`](../components/landing-preview.tsx),
 * including the numbers, which are a sample of what a season looks like rather
 * than anyone's real totals; a signed-out visitor has no diary to count, and a
 * stranger's is private.
 *
 * Clerk's buttons are client components, imported straight into this server
 * component; Next splits the bundle at that boundary so only they ship
 * JavaScript. `mode="modal"` opens the form over this page instead of
 * navigating, which is why there are no `/sign-in` or `/sign-up` routes.
 *
 * Not navigating is also why both buttons name a destination. The modal closes
 * onto this same page, and by then the session exists and Clerk's buttons have
 * gone inert — so without `fallbackRedirectUrl` a fresh sign-in would strand the
 * user here. `fallback` rather than `force`: it yields to a `redirect_url` in
 * the query string, so a protected deep link can still land where it was
 * headed. The proxy handles the other way in, someone arriving at `/` with a
 * session already in place.
 *
 * There is no theme toggle here — the top bar it lives in belongs to the app
 * shell, and a signed-out visitor has no chrome. The page still honours a
 * choice made inside the app, because that choice is an attribute on <html>
 * and these are the same semantic tokens every other screen uses.
 */

/**
 * What the footer, the GitHub button and the page's own claim all point at. One
 * constant, because a marketing page with two spellings of its own repository
 * URL is a broken link waiting for the second one to be edited.
 */
const GITHUB_URL = 'https://github.com/anonymouscoolguy/Madooo'

/**
 * The filled button, with foundations' complete state set for one: the inverse
 * surface, its hover step, `translateY(1px)` on press and the focus ring. Shared
 * by the header's primary action and the GitHub link, which is a `<button>` and
 * an `<a>` — so it is a string here rather than a component, and each caller
 * adds `no-underline` if it is a link.
 */
const FILLED =
  't-hover flex h-(--control-h-lg) cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-surface-inverse px-5 text-label text-inverse hover:bg-surface-inverse-hover active:translate-y-px focus-visible:focus-ring'

/**
 * Every section below the hero sits on the same rails: full-bleed rule, content
 * held to `--container`. The rule spans the viewport and the words do not, which
 * is the whole reason the padding cannot live on a single wrapper.
 */
const SECTION = 'border-t border-border'
const INNER = 'mx-auto max-w-(--container) px-4 py-16 md:px-6 md:py-24'

export default function Landing() {
  return (
    /*
      `--surface`, not `--page`. Every other screen sits on the page tone so
      that the cards on it read as raised off something; this one is flat, and
      its single card is separated by its border, which foundations calls the
      primary separator. The drawing is white edge to edge, including behind the
      header — the rule under the bar is the only thing dividing the two.

      It is also `bg-` on this element rather than a change to `body`, which
      belongs to the app: the two live in the same document and want different
      grounds. In dark they are the same colour anyway.
    */
    <div className="flex flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <OpenSource />
      </main>
      <SiteFooter />
    </div>
  )
}

/**
 * The same 56px bar the app shell puts over every signed-in screen, carrying
 * what a signed-out visitor needs instead: the wordmark, and the two ways in.
 *
 * The wordmark is `text-title`, the role the sidebar's own gives it — signed in
 * or signed out, the app is named once and in one size.
 */
function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      {/*
        `min-h` and `flex-wrap` rather than the app bar's fixed height: at 320px
        the wordmark and both actions come to more than the width, and the
        alternative — shrinking the buttons or shortening a label — is the
        scaling foundations rules out. So the bar keeps its height where the row
        fits and grows to two lines where it does not.
      */}
      <div className="mx-auto flex min-h-(--rail-w) max-w-(--container) flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:px-6">
        <span className="text-title">Madooo</span>

        <div className="flex items-center gap-2">
          <SignUpButton mode="modal" fallbackRedirectUrl="/fixtures">
            <button type="button" className={FILLED}>
              Create an account
            </button>
          </SignUpButton>

          {/*
            Outlined rather than the ghost button it used to be, as the design
            draws it: two actions side by side need the secondary one to have an
            edge, or it reads as a label sitting next to a button. Foundations'
            hover for a bordered control is the border going to `--border-strong`
            and the surface down a step.
          */}
          <SignInButton mode="modal" fallbackRedirectUrl="/fixtures">
            <button
              type="button"
              className="t-hover flex h-(--control-h-lg) cursor-pointer items-center whitespace-nowrap rounded-md border border-border bg-surface px-5 text-label text-text hover:border-border-strong hover:bg-surface-alt active:translate-y-px focus-visible:focus-ring"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    /*
      Two columns from `md` up, the copy beside the card. Below it they stack in
      source order, so the sentence explaining the product arrives before the
      picture of it — the reference drawings are desktop-only, and this is one of
      the places the narrow arrangement had to be decided rather than read off.
    */
    <div className="mx-auto grid max-w-(--container) items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
      <div>
        {/*
          A Tag: 24px and `rounded-full`, which foundations grants to Tags and
          pill tabs and to nothing else. The app's first one.
        */}
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-caps text-muted">
          <Icon name="lock" size="xs" />
          Free and open source
        </span>

        {/* The only use of `text-hero`, which exists for this line alone. One
            size at every width, like every other role: 48px still holds its
            longest word inside a 320px screen. */}
        <h1 className="mt-6 text-hero">
          A personal database for the football you watched.
        </h1>

        <p className="mt-6 text-body-lg text-muted">
          After full time, mark the players that made an impression on you and write down what you
          made of them.
        </p>
      </div>

      <LandingPreview />
    </div>
  )
}

/**
 * The three things the app does, in the order a user meets them: tag a player,
 * write about him, and find it again later.
 *
 * Each carries a sample of the real interface rather than a description of it,
 * which is why the third column has numbers in it — a database is the one of the
 * three with nothing to show but its size.
 */
function Features() {
  return (
    <section className={SECTION}>
      <div className={INNER}>
        <p className="text-caps text-faint">What it does</p>
        <h2 className="mt-4 text-display">Features</h2>

        <ul className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
          <li>
            <FeatureHead index="01" title="Rate the players">
              Rate anyone who left an impression on you during the match.
            </FeatureHead>
            {/* The three chips as they are drawn once applied — the same badge
                the diary reads back, so the sample is the product. */}
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge {...VERDICT_BADGE.STANDOUT} label="STANDOUT" />
              <Badge {...VERDICT_BADGE.FLOP} label="FLOP" />
              <Badge {...VERDICT_BADGE.MVP} label="MVP" />
            </div>
          </li>

          <li>
            <FeatureHead index="02" title="Take notes">
              A note on any player, dated to the fixture.
            </FeatureHead>
            {/*
              A note standing on its own as prose, which is the case foundations
              reserves `--text-body-lg` for — the rule beside it is in `--text`
              rather than `--border` because here the note is the subject rather
              than an annotation on a row.
            */}
            <figure className="mt-6 border-l-2 border-text pl-4">
              <figcaption className="text-caps text-faint">Declan Rice · v Tottenham</figcaption>
              <p className="mt-2 text-body-lg">Ran the game from deep. Never gave it away.</p>
            </figure>
          </li>

          <li>
            <FeatureHead index="03" title="Build a database">
              Every verdict and note is stored.
            </FeatureHead>
            {/* A sample season rather than a live count: nothing on this page
                reads the database, and there is no reader signed in to count. */}
            <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-4">
              {[
                { value: '37', label: 'Matches' },
                { value: '112', label: 'Players' },
                { value: '268', label: 'Notes' },
              ].map((stat) => (
                <li key={stat.label}>
                  {/* Numbers you can add up, so monospaced — `--text-stat` is
                      the role the app's own stat tiles use. */}
                  <p className="text-stat">{stat.value}</p>
                  <p className="mt-1 text-caption text-muted">{stat.label}</p>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </section>
  )
}

/**
 * A feature's number, name and sentence. Three copies of this block differing
 * only in their words is exactly the kind of thing that drifts, and the numbers
 * are monospaced for the usual reason.
 */
function FeatureHead({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <p className="text-data text-faint">{index}</p>
      <h3 className="mt-2 text-title">{title}</h3>
      <p className="mt-2 text-body text-muted">{children}</p>
    </>
  )
}

function OpenSource() {
  return (
    <section className={SECTION}>
      {/*
        The claim on the left, the way to check it on the right, and below `md`
        the button under the sentence it belongs to rather than floated away from
        it.
      */}
      <div className={`${INNER} flex flex-col gap-8 md:flex-row md:items-center md:justify-between`}>
        <div>
          <p className="text-caps text-faint">Free and open source</p>
          <h2 className="mt-4 text-display">Free, forever.</h2>
          <p className="mt-6 text-body-lg text-muted">
            Feel free to take a look at the code, or run your own copy if you so desire.
          </p>
        </div>

        {/* `no-underline` in both states: the base stylesheet styles every <a>
            as prose, which is right for a sentence and wrong for a button. */}
        <a
          href={GITHUB_URL}
          className={`${FILLED} self-start text-inverse no-underline hover:text-inverse hover:no-underline md:shrink-0 md:self-center`}
        >
          <Icon name="code" size="md" />
          View on GitHub
        </a>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    /*
      No rule above it, deliberately. The drawings carry exactly three — under
      the header and over each of the two sections — and the footer is not a
      fourth section: it is the end of the one above it, held apart by space
      rather than by a line.

      Which is also why the space is lopsided. The section's own 96px sits above
      the line and 24px below it, so it reads as the foot of the page rather
      than as a band of its own. Measured off the drawing, where the gap under
      the sentence is about a quarter of the gap over it.
    */
    <footer>
      <div className="mx-auto flex max-w-(--container) flex-col gap-2 px-4 pb-6 text-caption text-muted sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p>Madooo, a personal football database. Free and open source.</p>
        <a href={GITHUB_URL} className="text-muted hover:text-text">
          GitHub
        </a>
      </div>
    </footer>
  )
}
