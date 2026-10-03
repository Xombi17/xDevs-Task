import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SignSeal", template: "%s · SignSeal" },
  description: "Client approvals with a tamper-evident audit trail",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

function SealGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 text-accent" fill="none">
      <path
        d="M12 2.5 14.4 4l2.8-.2 1.2 2.5 2.4 1.4-.4 2.8L21.5 12l-1.1 2.5.4 2.8-2.4 1.4-1.2 2.5-2.8-.2L12 21.5 9.6 20l-2.8.2-1.2-2.5-2.4-1.4.4-2.8L2.5 12l1.1-2.5-.4-2.8 2.4-1.4 1.2-2.5 2.8.2L12 2.5Z"
        fill="currentColor"
        opacity="0.14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lift"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
              <SealGlyph />
              SignSeal
            </Link>
            <Link href="/projects/new" className="btn btn-primary">
              <span aria-hidden="true" className="-ml-0.5 text-base leading-none">+</span>
              New project
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
