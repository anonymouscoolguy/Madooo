import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        `ClerkProvider` sits inside `<body>`, not around `<html>`. Next 16
        requires it here; older Clerk examples wrap the whole document and break
        under cache components.

        `cssLayerName` gives Clerk's own styles a named cascade layer so they
        and Tailwind stop competing on specificity — the layer order is declared
        in `globals.css`.

        No header here: signed-out visitors on `/` and signed-in users under
        `/dashboard` want different chrome.
      */}
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ cssLayerName: "clerk" }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
