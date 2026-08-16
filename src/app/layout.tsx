import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { archivo, jetbrainsMono, materialSymbols } from "./fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Madooo",
  description: "A personal database for the football you watched.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
      The three font `variable` classes each declare one CSS custom property on
      <html>, holding the hashed family name next/font generated at build time.
      `globals.css` reads them into --font-sans, --font-mono and the .icon class;
      nothing else ever names a typeface.

      No `data-theme` attribute rendered here, deliberately. Light is the
      default and needs no attribute, so the server always emits the light
      document; the script below adds `data-theme="dark"` during parsing if the
      browser saved that choice.

      `suppressHydrationWarning` is what makes that legal. React compares the
      DOM it finds against what it rendered, and the script has just changed an
      attribute React knows nothing about — normally an error it recovers from
      by re-rendering, which is exactly the flash being avoided. This tells it
      to keep the DOM's version instead, and it applies to this element's own
      attributes only, not to the tree below.
    */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${jetbrainsMono.variable} ${materialSymbols.variable} h-full antialiased`}
    >
      <head>
        {/*
          Runs synchronously while the browser parses the head, so the theme is
          settled before the first paint. `dangerouslySetInnerHTML` is React's
          deliberately alarming name for "write this string as raw HTML" — the
          danger is injection, and what goes in here is a module constant with
          nothing interpolated into it. See `src/lib/theme.ts`.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/*
        `ClerkProvider` sits inside `<body>`, not around `<html>`. Next 16
        requires it here; older Clerk examples wrap the whole document and break
        under cache components.

        `cssLayerName` gives Clerk's own styles a named cascade layer so they
        and Tailwind stop competing on specificity — the layer order is declared
        in `globals.css`.

        `variables` are handed `var(--…)` references rather than colours, which
        is the whole reason Clerk follows the theme toggle. Clerk writes them
        into CSS custom properties on its own elements, so they resolve in the
        DOM — under the same `data-theme` on <html> as everything else, and they
        re-resolve when it flips. Passing resolved values instead would freeze
        Clerk's UI in whichever theme was current when this server component
        rendered.

        No header here: signed-out visitors on `/` and signed-in users inside the
        app shell want different chrome.
      */}
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            cssLayerName: "clerk",
            variables: {
              colorBackground: "var(--surface)",
              colorForeground: "var(--text)",
              colorMutedForeground: "var(--text-muted)",
              colorMuted: "var(--surface-alt)",
              colorInput: "var(--surface)",
              colorInputForeground: "var(--text)",
              colorBorder: "var(--border)",
              colorRing: "var(--border-focus)",
              colorModalBackdrop: "var(--overlay)",
              colorPrimary: "var(--surface-inverse)",
              colorPrimaryForeground: "var(--text-inverse)",
              colorDanger: "var(--flop)",
              colorSuccess: "var(--standout)",
              colorWarning: "var(--mvp)",
              fontFamily: "var(--font-sans)",
              borderRadius: "var(--radius-md)",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
