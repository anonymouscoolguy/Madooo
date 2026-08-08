import { SignInButton, SignUpButton } from '@clerk/nextjs'

/**
 * Public, and deliberately touches no database — so unlike `/fixtures` it can
 * be prerendered at build time and needs no `dynamic` export.
 *
 * Clerk's buttons are client components, imported straight into this server
 * component; Next splits the bundle at that boundary so only they ship
 * JavaScript. `mode="modal"` opens the form over this page instead of
 * navigating, which is why there are no `/sign-in` or `/sign-up` routes.
 *
 * There is no theme toggle here — the top bar it lives in belongs to the app
 * shell, and a signed-out visitor has no chrome. The page still honours a
 * choice made inside the app, because that choice is an attribute on <html>
 * and these are the same semantic tokens every other screen uses.
 */
export default function Landing() {
  return (
    <div className="flex flex-1 items-center justify-center bg-page px-4 py-16 md:px-6">
      <main className="w-full max-w-md text-center">
        <h1 className="text-display text-text">Madooo</h1>
        <p className="mt-4 text-body-lg text-muted">
          A private match diary. Rate the players after a game, keep a note on
          the ones worth remembering, and read it all back later.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          {/*
            The primary action is the inverse surface — black on light, white on
            dark. No pill: the `rounded-full` radius belongs to Tags and pill
            Tabs alone. Hover, press and focus are the filled button's three
            states in full, and the "Save note" button carries the same set.
          */}
          <SignUpButton mode="modal">
            <button
              type="button"
              className="t-hover flex h-(--control-h-lg) cursor-pointer items-center rounded-md bg-surface-inverse px-5 text-label text-inverse hover:bg-surface-inverse-hover active:translate-y-px focus-visible:focus-ring"
            >
              Create an account
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="t-hover flex h-(--control-h-lg) cursor-pointer items-center rounded-md px-5 text-label text-muted hover:bg-surface-alt hover:text-text focus-visible:focus-ring"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </main>
    </div>
  )
}
