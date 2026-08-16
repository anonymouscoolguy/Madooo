/**
 * Outbound links to places that are not this app.
 *
 * There is exactly one of them so far, and it is here rather than in the file
 * that first needed it because two files now do: the landing page points at the
 * repository from its footer, its "Free, forever" section and its own claim to
 * be open source, and the app shell's top bar points at it from every signed-in
 * screen. A URL spelled out in two files is a broken link waiting for the second
 * one to be edited.
 */
export const GITHUB_URL = 'https://github.com/miguelcfernandes/Madooo'
