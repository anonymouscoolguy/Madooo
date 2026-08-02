import { SignInButton, SignUpButton } from '@clerk/nextjs'

/**
 * Public, and deliberately touches no database — so unlike `/fixtures` it can
 * be prerendered at build time and needs no `dynamic` export.
 *
 * Clerk's buttons are client components, imported straight into this server
 * component; Next splits the bundle at that boundary so only they ship
 * JavaScript. `mode="modal"` opens the form over this page instead of
 * navigating, which is why there are no `/sign-in` or `/sign-up` routes.
 */
export default function Landing() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Madooo
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          A private match diary. Rate the players after a game, keep a note on
          the ones worth remembering, and read it all back later.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          <SignUpButton mode="modal">
            <button className="cursor-pointer rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200">
              Create an account
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
              Sign in
            </button>
          </SignInButton>
        </div>
      </main>
    </div>
  )
}
