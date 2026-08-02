/**
 * The two things the inline script in `layout.tsx` and the toggle button have
 * to agree on. They run at completely different moments — one during HTML
 * parsing, one on a click, months of edits apart — so the storage key lives in
 * one module rather than being typed out twice.
 *
 * The theme itself is not stored in React state anywhere. `<html data-theme>`
 * is the state, CSS is the only thing that reads it, and both writers below
 * only ever touch that attribute and this key.
 */

export const THEME_STORAGE_KEY = 'madooo-theme'

/**
 * Restores a saved dark preference before the browser paints.
 *
 * It is a *string* of JavaScript rather than a function because it is injected
 * into a `<script>` tag in the document head, where it runs synchronously as the
 * HTML is parsed — before React exists, before any stylesheet has painted a
 * light background that would then flip to dark in front of the user. Nothing
 * running after hydration can do that: `useEffect` runs after paint, and even
 * `useLayoutEffect` runs after React has loaded and rendered.
 *
 * Hence the deliberately plain style: no imports, no modern syntax worth
 * risking, and a `try` around `localStorage`, which throws outright rather than
 * returning null in some privacy modes. An uncaught throw here would abort
 * parsing the document.
 *
 * Only `"dark"` is ever written, so there is nothing to restore for light.
 */
export const THEME_INIT_SCRIPT =
  `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")` +
  `{document.documentElement.dataset.theme="dark"}}catch(e){}})()`
