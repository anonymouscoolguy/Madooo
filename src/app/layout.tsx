import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { archivo, jetbrainsMono, materialSymbols } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Madooo",
  description: "A private match diary for football fans.",
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

      No `data-theme` attribute, deliberately. The absence is what lets
      `color-scheme: light dark` follow the operating system, which is the whole
      of the app's theming until step 8.1 adds a toggle that writes one.
    */
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrainsMono.variable} ${materialSymbols.variable} h-full antialiased`}
    >
      {/*
        `ClerkProvider` sits inside `<body>`, not around `<html>`. Next 16
        requires it here; older Clerk examples wrap the whole document and break
        under cache components.

        `cssLayerName` gives Clerk's own styles a named cascade layer so they
        and Tailwind stop competing on specificity — the layer order is declared
        in `globals.css`.

        No header here: signed-out visitors on `/` and signed-in users inside the
        app shell want different chrome.
      */}
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ cssLayerName: "clerk" }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
